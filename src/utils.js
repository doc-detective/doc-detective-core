const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const fs = require("fs");
const { exit } = require("process");
const path = require("path");
const uuid = require("uuid");
const nReadlines = require("n-readlines");
const { spawn } = require("child_process");
const defaultConfig = require("../config.json");
const { validate } = require("doc-detective-common");

exports.setArgs = setArgs;
exports.setFiles = setFiles;
exports.parseTests = parseTests;
exports.outputResults = outputResults;
exports.setEnvs = setEnvs;
exports.loadEnvsForObject = loadEnvsForObject;
exports.log = log;
exports.timestamp = timestamp;
exports.loadEnvs = loadEnvs;
exports.spawnCommand = spawnCommand;

// Define args
function setArgs(args) {
  if (!args) return {};
  let argv = yargs(hideBin(args))
    .option("config", {
      alias: "c",
      description: "Path to a custom config file.",
      type: "string",
    })
    .option("input", {
      alias: "i",
      description: "Path to a file or directory to parse for tests.",
      type: "string",
    })
    .option("output", {
      alias: "o",
      description: "Path for a JSON file of test result output.",
      type: "string",
    })
    .option("setup", {
      description:
        "Path to a file or directory to parse for tests to run before 'input' tests. Useful for preparing environments to perform tests.",
      type: "string",
    })
    .option("cleanup", {
      description:
        "Path to a file or directory to parse for tests to run after 'input' tests. Useful for resetting environments after tests run.",
      type: "string",
    })
    .option("recursive", {
      alias: "r",
      description:
        "Boolean. Recursively find test files in the test directory. Defaults to true.",
      type: "string",
    })
    .option("coverageOutput", {
      description: "Path for a JSON file of coverage result output.",
      type: "string",
    })
    .option("ext", {
      description:
        "Comma-separated list of file extensions to test, including the leading period.",
      type: "string",
    })
    .option("env", {
      alias: "e",
      description:
        "Path to file of environment variables to set before running tests.",
      type: "string",
    })
    .option("mediaDir", {
      description: "Path to the media output directory.",
      type: "string",
    })
    .option("downloadDir", {
      description: "Path to the download directory.",
      type: "string",
    })
    .option("saveFailedTestRecordings", {
      description:
        "Boolean. Whether to save recordings of failed tests. Defaults to true.",
      type: "string",
    })
    .option("failedTestDir", {
      description: "Path to the failed test directory.",
      type: "string",
    })
    .option("browserHeadless", {
      description:
        "Boolean. Whether to run the browser in headless mode. Defaults to true.",
      type: "string",
    })
    .option("browserPath", {
      description:
        "Path to a browser executable to run instead of puppeteer's bundled Chromium.",
      type: "string",
    })
    .option("browserHeight", {
      description:
        "Height of the browser viewport in pixels. Default is 600 px.",
      type: "number",
    })
    .option("browserWidth", {
      description:
        "Width of the browser viewport in pixels. Default is 800 px.",
      type: "number",
    })
    .option("logLevel", {
      alias: "l",
      description:
        "Detail level of logging events. Accepted values: silent, error, warning, info (default), debug",
      type: "string",
    })
    .help()
    .alias("help", "h").argv;

  return argv;
}

// Set array of test files
function setFiles(config) {
  let dirs = [];
  let files = [];
  let sequence = [];

  // Determine source sequence
  const setup = config.runTests.setup;
  if (setup) sequence = sequence.concat(setup);
  const input = config.runTests.input || config.input;
  sequence = sequence.concat(input);
  const cleanup = config.runTests.cleanup;
  if (cleanup) sequence = sequence.concat(cleanup);

  for (const source of sequence) {
    let isFile = fs.statSync(source).isFile();
    let isDir = fs.statSync(source).isDirectory();

    // Parse input
    if (isFile && isValidSourceFile(config, files, source)) {
      // Passes all checks
      files.push(source);
    } else if (isDir) {
      // Load files from directory
      dirs = [];
      dirs[0] = source;
      for (const dir of dirs) {
        fs.readdirSync(dir).forEach((object) => {
          const content = path.resolve(dir + "/" + object);
          const isFile = fs.statSync(content).isFile();
          const isDir = fs.statSync(content).isDirectory();
          if (isFile && isValidSourceFile(config, files, content)) {
            files.push(content);
          } else if (isDir && (config.runTests.recursive || config.recursive)) {
            // recursive set to true
            dirs.push(content);
          }
        });
      }
    }
  }
  return files;
}

function isValidSourceFile(config, files, source) {
  // Determine allowed extensions
  let allowedExtensions = [".json"];
  config.fileTypes.forEach((fileType) => {
    allowedExtensions = allowedExtensions.concat(fileType.extensions);
  });

  // Is present in files array already
  if (files.indexOf(source) >= 0) return false;
  // Is JSON but isn't a valid spec-formatted JSON object
  if (path.extname(source) === ".json") {
    const json = JSON.parse(fs.readFileSync(source).toString());
    const validation = validate("spec_v2", json);
    if (!validation.valid) {
      log(
        config,
        "warning",
        `${source} isn't a valid test specification. Skipping.`
      );
      return false;
    }
  }
  // If extension isn't in list of allowed extensions
  if (!allowedExtensions.includes(path.extname(source))) return false;

  return true;
}

// Parse files for tests
function parseTests(config, files) {
  let json = { tests: [] };

  // Loop through test files
  files.forEach((file) => {
    log(config, "debug", `file: ${file}`);
    let fileId = `${uuid.v4()}`;
    let id = fileId;
    let line;
    let lineNumber = 1;
    let inputFile = new nReadlines(file);
    let extension = path.extname(file);
    let fileType = config.fileTypes.find((fileType) =>
      fileType.extensions.includes(extension)
    );
    let testStartStatementOpen;
    let testStartStatementClose;
    let testEndStatement;
    let actionStatementOpen;
    let actionStatementClose;

    if (typeof fileType != "undefined") {
      testStartStatementOpen = fileType.testStartStatementOpen;
      if (!testStartStatementOpen) {
        log(
          config,
          "warning",
          `Skipping tests in ${file}. No 'testStartStatementOpen' value specified.`
        );
        return;
      }
      testStartStatementClose = fileType.testStartStatementClose;
      if (!testStartStatementClose) {
        log(
          config,
          "warning",
          `Skipping tests in ${file}. No 'testStartStatementClose' value specified.`
        );
        return;
      }
      testEndStatement = fileType.testEndStatement;
      if (!testEndStatement) {
        log(
          config,
          "warning",
          `Skipping tests in ${file}. No 'testEndStatement' value specified.`
        );
        return;
      }
      actionStatementOpen =
        fileType.actionStatementOpen ||
        fileType.openActionStatement ||
        fileType.openTestStatement;
      if (!actionStatementOpen) {
        log(
          config,
          "warning",
          `Skipping tests in ${file}. No 'actionStatementOpen' value specified.`
        );
        return;
      }
      actionStatementClose =
        fileType.actionStatementClose ||
        fileType.closeActionStatement ||
        fileType.closeTestStatement;
      if (!actionStatementClose) {
        log(
          config,
          "warning",
          `Skipping tests in ${file}. No 'actionStatementClose' value specified.`
        );
        return;
      }
    }

    if (!fileType && extension !== ".json") {
      // Missing filetype options
      log(
        config,
        "warning",
        `Skipping file with ${extension} extension. Specify options for the ${extension} extension in your config file.`
      );
      return;
    }

    // If file is JSON, add tests straight to array
    if (path.extname(file) === ".json") {
      content = require(file);
      if (typeof content.tests === "object" && content.tests.length > 0) {
        content.tests.forEach((test) => {
          json.tests.push(test);
        });
      } else {
        log(
          config,
          "debug",
          `Skipping ${file} because of unexpected object structure.`
        );
        return;
      }
    } else {
      // Loop through lines
      while ((line = inputFile.next())) {
        let lineJson;
        let subStart;
        let subEnd;
        const lineAscii = line.toString("ascii");

        if (line.includes(testStartStatementOpen)) {
          // Test start
          if (testStartStatementClose) {
            subEnd = lineAscii.lastIndexOf(testStartStatementClose);
          } else {
            subEnd = lineAscii.length;
          }
          subStart =
            lineAscii.indexOf(testStartStatementOpen) +
            testStartStatementOpen.length;
          lineJson = JSON.parse(lineAscii.substring(subStart, subEnd));
          // If test is defined in this file instead of referencing a test defined in another file
          if (!lineJson.file) {
            test = { id, file, actions: [] };
            if (lineJson.id) {
              test.id = lineJson.id;
              // Set ID for following actions
              id = lineJson.id;
            }
            if (lineJson.saveFailedTestRecordings)
              test.saveFailedTestRecordings = lineJson.saveFailedTestRecordings;
            if (lineJson.failedTestDirectory)
              test.failedTestDirectory = lineJson.failedTestDirectory;
            json.tests.push(test);
          }
        } else if (line.includes(testEndStatement)) {
          // Revert back to file-based ID
          id = fileId;
        } else if (line.includes(actionStatementOpen)) {
          if (actionStatementClose) {
            subEnd = lineAscii.lastIndexOf(actionStatementClose);
          } else {
            subEnd = lineAscii.length;
          }
          subStart =
            lineAscii.indexOf(actionStatementOpen) + actionStatementOpen.length;
          lineJson = JSON.parse(lineAscii.substring(subStart, subEnd));
          if (!lineJson.testId) {
            lineJson.testId = id;
          }
          let test = json.tests.find((item) => item.id === lineJson.testId);
          if (!test) {
            json.tests.push({ id: lineJson.testId, file, actions: [] });
            test = json.tests.find((item) => item.id === lineJson.testId);
          }
          delete lineJson.testId;
          lineJson.line = lineNumber;
          test.actions.push(lineJson);
        }
        lineNumber++;
      }
    }
  });
  return json;
}

async function outputResults(path, results, config) {
  let data = JSON.stringify(results, null, 2);
  fs.writeFile(path, data, (err) => {
    if (err) throw err;
  });
  log(config, "info", "RESULTS:");
  log(config, "info", results);
  log(config, "info", `See results at ${path}`);
  log(config, "info", "Cleaning up and finishing post-processing.");
}

async function setEnvs(envsFile) {
  const fileExists = fs.existsSync(envsFile);
  if (fileExists) {
    require("dotenv").config({ path: envsFile, override: true });
    return { status: "PASS", description: "Envs set." };
  } else {
    return { status: "FAIL", description: "Invalid file." };
  }
}

async function log(config, level, message) {
  let logLevelMatch = false;
  if (config.logLevel === "error" && level === "error") {
    logLevelMatch = true;
  } else if (
    config.logLevel === "warning" &&
    (level === "error" || level === "warning")
  ) {
    logLevelMatch = true;
  } else if (
    config.logLevel === "info" &&
    (level === "error" || level === "warning" || level === "info")
  ) {
    logLevelMatch = true;
  } else if (
    config.logLevel === "debug" &&
    (level === "error" ||
      level === "warning" ||
      level === "info" ||
      level === "debug")
  ) {
    logLevelMatch = true;
  }

  if (logLevelMatch) {
    if (typeof message === "string") {
      let logMessage = `(${level.toUpperCase()}) ${message}`;
      console.log(logMessage);
    } else if (typeof message === "object") {
      let logMessage = `(${level.toUpperCase()})`;
      console.log(logMessage);
      console.log(message);
    }
  }
}

function loadEnvs(stringOrObject) {
  if (!stringOrObject) return stringOrObject;
  // Try to convert string to object
  try {
    if (
      typeof stringOrObject === "string" &&
      typeof JSON.parse(stringOrObject) === "object"
    ) {
      stringOrObject = JSON.parse(stringOrObject);
    }
  } catch {}
  if (typeof stringOrObject === "object") {
    // Load for object
    stringOrObject = loadEnvsForObject(stringOrObject);
  } else if (typeof stringOrObject === "string") {
    // Load for string
    stringOrObject = loadEnvsForString(stringOrObject);
  }
  // Try to convert resolved string to object
  try {
    if (typeof JSON.parse(stringOrObject) === "object") {
      stringOrObject = JSON.parse(stringOrObject);
    }
  } catch {}
  return stringOrObject;
}

function loadEnvsForString(string) {
  // Find all variables
  variableRegex = new RegExp(/\$[a-zA-Z0-9_]+/, "g");
  console.log(string);
  matches = string.match(variableRegex);
  // If no matches, return
  if (!matches) return string;
  // Iterate matches
  matches.forEach((match) => {
    // Check if is declared variable
    value = process.env[match.substring(1)];
    if (value) {
      // If variable value might have a nested variable, recurse to try to resolve
      if (value.includes("$")) value = loadEnvs(value);
      // Convert to string in case value was a substring of the greater string
      if (typeof value === "object") value = JSON.stringify(value);
      // Replace match with variable value
      string = string.replace(match, value);
    }
  });
  return string;
}

function loadEnvsForObject(object) {
  Object.keys(object).forEach((key) => {
    // Resolve all variables in key value
    object[key] = loadEnvs(object[key]);
  });
  return object;
}

function timestamp() {
  let timestamp = new Date();
  return `${timestamp.getFullYear()}${("0" + (timestamp.getMonth() + 1)).slice(
    -2
  )}${("0" + timestamp.getDate()).slice(-2)}-${(
    "0" + timestamp.getHours()
  ).slice(-2)}${("0" + timestamp.getMinutes()).slice(-2)}${(
    "0" + timestamp.getSeconds()
  ).slice(-2)}`;
}

// Perform a command
async function spawnCommand(cmd, args) {
  const runCommand = spawn(cmd, args);

  // Capture stdout
  let stdout = "";
  for await (const chunk of runCommand.stdout) {
    stdout += chunk;
  }
  // Remove trailing newline
  stdout = stdout.replace(/\n$/, "");

  // Capture stderr
  let stderr = "";
  for await (const chunk of runCommand.stderr) {
    stderr += chunk;
  }
  // Remove trailing newline
  stderr = stderr.replace(/\n$/, "");

  // Capture exit code
  const exitCode = await new Promise((resolve, reject) => {
    runCommand.on("close", resolve);
  });

  return { stdout, stderr, exitCode };
}
