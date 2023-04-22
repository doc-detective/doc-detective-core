const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const fs = require("fs");
const { exit } = require("process");
const path = require("path");
const uuid = require("uuid");
const { spawn, exec } = require("child_process");
const { validate } = require("doc-detective-common");

exports.setFiles = setFiles;
exports.parseTests = parseTests;
exports.outputResults = outputResults;
exports.setEnvs = setEnvs;
exports.loadEnvsForObject = loadEnvsForObject;
exports.log = log;
exports.timestamp = timestamp;
exports.loadEnvs = loadEnvs;
exports.spawnCommand = spawnCommand;

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
      files.push(path.resolve(source));
    } else if (isDir) {
      // Load files from directory
      dirs = [];
      dirs[0] = source;
      for (const dir of dirs) {
        fs.readdirSync(dir).forEach((object) => {
          const content = path.resolve(dir + "/" + object);
          // Exclude node_modules
          if (content.includes("node_modules")) return;
          // Check if file or directory
          const isFile = fs.statSync(content).isFile();
          const isDir = fs.statSync(content).isDirectory();
          // Add to files or dirs array
          if (isFile && isValidSourceFile(config, files, content)) {
            files.push(path.resolve(content));
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
    const jsonContent = fs.readFileSync(source).toString();
    const json = JSON.parse(jsonContent);
    const validation = validate("spec_v2", json);
    if (!validation.valid) {
      log(
        config,
        "log",
        `${source} isn't a valid test specification. Skipping.`
      );
      return false;
    }
  }
  // If extension isn't in list of allowed extensions
  if (!allowedExtensions.includes(path.extname(source))) {
    log(
      config,
      "log",
      `${source} extension isn't specified in a \`config.fileTypes\` object. Skipping.`
    );
    return false;
  }

  return true;
}

// Parse files for tests
function parseTests(config, files) {
  let specs = [];

  // Loop through files
  for (const file of files) {
    log(config, "debug", `file: ${file}`);
    const extension = path.extname(file);
    let content = fs.readFileSync(file).toString();

    if (extension === ".json") {
      // Process JSON
      content = JSON.parse(content);
      specs.push(content);
    } else {
      // Process non-JSON
      let id = `${uuid.v4()}`;
      const spec = { id, file, tests: [] };
      content = content.split("\n");
      fileType = config.fileTypes.find((fileType) =>
        fileType.extensions.includes(extension)
      );
      for (const line of content) {
        // console.log(line);
        if (line.includes(fileType.testStartStatementOpen)) {
          // Test start statement
          startStatementOpen =
            line.indexOf(fileType.testStartStatementOpen) +
            fileType.testStartStatementOpen.length;
          if (line.includes(fileType.testStartStatementClose)) {
            startStatementClose = line.lastIndexOf(
              fileType.testStartStatementClose
            );
          } else {
            startStatementClose = line.length;
          }
          startStatement = line.substring(
            startStatementOpen,
            startStatementClose
          );
          // Parse JSON
          statementJson = JSON.parse(startStatement);
          // Add `file` property
          statementJson.file = file;
          // Add `steps` array
          statementJson.steps = [];
          // Push to spec if `file` isn't set
          if (!statementJson.file) {
            spec.tests.push(statementJson);
          }
          // Set id if `id` is set
          if (statementJson.id) {
            id = statementJson.id;
          }
        } else if (line.includes(fileType.stepStatementOpen)) {
          // Find step statement
          if (line.includes(fileType.stepStatementOpen)) {
            stepStatementOpen =
              line.indexOf(fileType.stepStatementOpen) +
              fileType.stepStatementOpen.length;
            if (line.includes(fileType.stepStatementClose)) {
              stepStatementClose = line.lastIndexOf(
                fileType.stepStatementClose
              );
            } else {
              stepStatementClose = line.length;
            }
            stepStatement = line.substring(
              stepStatementOpen,
              stepStatementClose
            );
            // Parse JSON
            statementJson = JSON.parse(stepStatement);
            // Find test with `id`
            test = spec.tests.find((test) => test.id === id);
            // If test doesn't exist, create it
            if (!test) {
              test = { id, file, steps: [] };
              spec.tests.push(test);
              test = spec.tests.find((test) => test.id === id);
            }
            // Push to test
            test.steps.push(statementJson);
          }
        } else if (line.includes(fileType.testEndStatement)) {
          // Set `id` to new UUID
          id = `${uuid.v4()}`;
        }
      }
      // Push spec to specs, if it is valid
      const validation = validate("spec_v2", spec);
      if (!validation.valid) {
        log(
          config,
          "warning",
          `Tests from ${file} don't create a valid test specification. Skipping.`
        );
      } else {
        specs.push(spec);
      }
    }
  }
  return specs;
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

// Perform a native command in the current working directory.
async function spawnCommand(cmd, args, options) {
  // Set default options
  if (!options) options = {};

  // Split command into command and arguments
  if (cmd.includes(" ")) {
    const cmdArray = cmd.split(" ");
    cmd = cmdArray[0];
    cmdArgs = cmdArray.slice(1);
    // Add arguments to args array
    if (args) {
      args = cmdArgs.concat(args);
    } else {
      args = cmdArgs;
    }
  }

  const runCommand = spawn(cmd, args);

  // Capture stdout
  let stdout = "";
  for await (const chunk of runCommand.stdout) {
    stdout += chunk;
    if (options.debug) console.log(chunk.toString());
  }
  // Remove trailing newline
  stdout = stdout.replace(/\n$/, "");

  // Capture stderr
  let stderr = "";
  for await (const chunk of runCommand.stderr) {
    stderr += chunk;
    if (options.debug) console.log(chunk.toString());
  }
  // Remove trailing newline
  stderr = stderr.replace(/\n$/, "");

  // Capture exit code
  const exitCode = await new Promise((resolve, reject) => {
    runCommand.on("close", resolve);
  });

  return { stdout, stderr, exitCode };
}
