const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const axios = require("axios");
const path = require("path");
const uuid = require("uuid");
const { spawn } = require("child_process");
const { validate, resolvePaths } = require("doc-detective-common");

exports.qualityFiles = qualityFiles;
exports.parseTests = parseTests;
exports.outputResults = outputResults;
exports.loadEnvs = loadEnvs;
exports.log = log;
exports.timestamp = timestamp;
exports.replaceEnvs = replaceEnvs;
exports.spawnCommand = spawnCommand;
exports.inContainer = inContainer;
exports.cleanTemp = cleanTemp;
exports.calculatePercentageDifference = calculatePercentageDifference;
exports.fetchFile = fetchFile;

// Delete all contents of doc-detective temp directory
function cleanTemp() {
  const tempDir = `${os.tmpdir}/doc-detective`;
  if (fs.existsSync(tempDir)) {
    fs.readdirSync(tempDir).forEach((file) => {
      const curPath = `${tempDir}/${file}`;
      fs.unlinkSync(curPath);
    });
  }
}

// Fetch a file from a URL and save to a temp directory
// If the file is not JSON, return the contents as a string
// If the file is not found, return an error
async function fetchFile(fileURL) {
  try {
    const response = await axios.get(fileURL);
    if (typeof response.data === "object") {
      response.data = JSON.stringify(response.data, null, 2);
    } else {
      response.data = response.data.toString();
    }
    const fileName = fileURL.split("/").pop();
    const hash = crypto.createHash("md5").update(response.data).digest("hex");
    const filePath = `${os.tmpdir}/doc-detective/${hash}_${fileName}`;
    // If doc-detective temp directory doesn't exist, create it
    if (!fs.existsSync(`${os.tmpdir}/doc-detective`)) {
      fs.mkdirSync(`${os.tmpdir}/doc-detective`);
    }
    // If file doesn't exist, write it
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, response.data);
    }
    return { result: "success", path: filePath };
  } catch (error) {
    return { result: "error", message: error };
  }
}

// Inspect and qualify files as valid inputs
async function qualityFiles({config}) {
  let dirs = [];
  let files = [];
  let sequence = [];

  // Determine source sequence
  const setup = config.beforeAny;
  if (setup) sequence = sequence.concat(setup);
  const input = config.input;
  sequence = sequence.concat(input);
  const cleanup = config.afterAll;
  if (cleanup) sequence = sequence.concat(cleanup);

  for (let source of sequence) {
    log(config, "debug", `source: ${source}`);
    // Check if source is a URL
    let isURL = source.startsWith("http://") || source.startsWith("https://");
    // If URL, fetch file and place in temp directory
    if (isURL) {
      const fetch = await fetchFile(source);
      if (fetch.result === "error") {
        log(config, "warning", fetch.message);
        continue;
      }
      source = fetch.path;
    }
    // Check if source is a file or directory
    let isFile = fs.statSync(source).isFile();
    let isDir = fs.statSync(source).isDirectory();

    // Parse input
    if (isFile && isValidSourceFile({config, files, source})) {
      // Passes all checks
      files.push(path.resolve(source));
    } else if (isDir) {
      // Load files from directory
      dirs = [];
      dirs[0] = source;
      for (const dir of dirs) {
        fs.readdirSync(dir).forEach((object) => {
          const content = path.resolve(dir + "/" + object);
          // Exclude node_modules for local installs
          if (content.includes("node_modules")) return;
          // Check if file or directory
          const isFile = fs.statSync(content).isFile();
          const isDir = fs.statSync(content).isDirectory();
          // Add to files or dirs array
          if (isFile && isValidSourceFile({config, files, source: content})) {
            files.push(path.resolve(content));
          } else if (isDir && (config.recursive)) {
            // recursive set to true
            dirs.push(content);
          }
        });
      }
    }
  }
  return files;
}

// Check if a source file is valid based on fileType definitions
function isValidSourceFile({config, files, source}) {
  log(config, "debug", `validation: ${source}`);
  // Determine allowed extensions
  let allowedExtensions = ["json"];
  config.fileTypes.forEach((fileType) => {
    allowedExtensions = allowedExtensions.concat(fileType.extensions);
  });
  // Is present in files array already
  if (files.indexOf(source) >= 0) return false;
  // Is JSON but isn't a valid spec-formatted JSON object
  if (path.extname(source) === ".json") {
    const jsonContent = fs.readFileSync(source).toString();
    let json = {};
    try {
      json = JSON.parse(jsonContent);
    } catch {
      log(
        config,
        "debug",
        `${source} isn't a valid test specification. Skipping.`
      );
      return false;
    }
    const validation = validate({schemaKey: "spec_v3", object: json, addDefaults: false});
    if (!validation.valid) {
      log(config, "warning", validation);
      log(
        config,
        "warning",
        `${source} isn't a valid test specification. Skipping.`
      );
      return false;
    }
    // TODO: Move `before` and `after checking out of is and into a broader test validation function
    // If any objects in `tests` array have `before` or `after` property, make sure those files exist
    for (const test of json.tests) {
      if (test.before) {
        let beforePath = "";
        if (config.relativePathBase === "file") {
          beforePath = path.resolve(path.dirname(source), test.setup);
        } else {
          beforePath = path.resolve(test.setup);
        }
        if (!fs.existsSync(beforePath)) {
          log(
            config,
            "debug",
            `${beforePath} is specified to run before a test but isn't a valid file. Skipping ${source}.`
          );
          return false;
        }
      }
      if (test.after) {
        let afterPath = "";
        if (config.relativePathBase === "file") {
          afterPath = path.resolve(path.dirname(source), test.cleanup);
        } else {
          afterPath = path.resolve(test.cleanup);
        }
        if (!fs.existsSync(afterPath)) {
          log(
            config,
            "debug",
            `${afterPath} is specified to run after a test but isn't a valid file. Skipping ${source}.`
          );
          return false;
        }
      }
    }
  }
  // If extension isn't in list of allowed extensions
  const extension = path.extname(source).substring(1);
  if (!allowedExtensions.includes(extension)) {
    log(
      config,
      "debug",
      `${source} extension isn't specified in a \`config.fileTypes\` object. Skipping.`
    );
    return false;
  }

  return true;
}

// Parse files for tests
async function parseTests({config, files}) {
  let specs = [];

  // Loop through files
  for (const file of files) {
    log(config, "debug", `file: ${file}`);
    const extension = path.extname(file);
    let content = "";
    content = fs.readFileSync(file).toString();

    if (extension === ".json") {
      // Process JSON
      content = JSON.parse(content);
        // Resolve to catch any relative setup or cleanup paths
      content = await resolvePaths({config: config, object: content, filePath: file});

      for (const test of content.tests) {
        // If any objects in `tests` array have `before` property, add `tests[0].steps` of before to the beginning of the object's `steps` array.
        if (test.before) {
          const setupContent = fs.readFileSync(test.before).toString();
          const setup = JSON.parse(setupContent);
          test.steps = setup.tests[0].steps.concat(test.steps);
        }
        // If any objects in `tests` array have `after` property, add `tests[0].steps` of after to the end of the object's `steps` array.
        if (test.after) {
          const cleanupContent = fs.readFileSync(test.after).toString();
          const cleanup = JSON.parse(cleanupContent);
          test.steps = test.steps.concat(cleanup.tests[0].steps);
        }
      }
      // Validate each step
      for (const test of content.tests) {
        // Filter out steps that don't pass validation
        test.steps.forEach((step) => {
          const validation = validate({schemaKey: `step_v3`, object: { ...step}, addDefaults: false});
          if (!validation.valid) {
            log(
              config,
              "warning",
              `Step ${step} isn't a valid step. Skipping.`
            );
            return false;
          }
          return true;
        });
      }
      const validation = validate({schemaKey: "spec_v3", object: content, addDefaults: false});
      if (!validation.valid) {
        log(config, "warning", validation);
        log(
          config,
          "warning",
          `After applying setup and cleanup steps, ${file} isn't a valid test specification. Skipping.`
        );
        return false;
      }
      // Make sure that object is now a valid v3 spec
      content = validation.object;
      // Resolve previously unapplied defaults
      content = await resolvePaths({config: config, object: content, filePath: file});
      specs.push(content);
    } else {
      // Process non-JSON
      let id = `${uuid.v4()}`;
      let spec = { id, file, tests: [] };
      content = content.split("\n");
      let ignore = false;
      fileType = config.fileTypes.find((fileType) =>
        fileType.extensions.includes(extension)
      );
      for (const line of content) {
        // console.log(line);
        if (line.includes(fileType.testStartStatementOpen)) {
          // Test start statement
          id = `${uuid.v4()}`;
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
          // Set id if `id` is set
          if (statementJson.id) {
            // If `id` already exists in the spec, set it to the `id` with a dash and a new UUID
            if (spec.tests.find((test) => test.id === statementJson.id)) {
              statementJson.id = `${statementJson.id}-${uuid.v4()}`;
            }
            id = statementJson.id;
          } else {
            statementJson.id = id;
          }
          // The `test` has the `setup` property, add `tests[0].steps` of setup to the beginning of the object's `steps` array.
          if (statementJson.setup) {
            // If `setup` is a relative path, resolve it
            if (
              config.relativePathBase === "file" &&
              !path.isAbsolute(statementJson.setup)
            ) {
              statementJson.setup = path.resolve(
                path.dirname(file),
                statementJson.setup
              );
            }
            // Load setup steps
            const setupContent = fs
              .readFileSync(statementJson.setup)
              .toString();
            const setup = JSON.parse(setupContent);
            if (
              setup &&
              setup.tests &&
              setup.tests[0] &&
              setup.tests[0].steps
            ) {
              statementJson.steps = setup.tests[0].steps.concat(
                statementJson.steps
              );
            } else {
              console.error("Setup file does not contain valid steps.");
            }
          }
          // Push to spec
          spec.tests.push(statementJson);
          // Set `ignore` to false
          ignore = false;
        } else if (line.includes(fileType.testEndStatement)) {
          // Find test with `id`
          test = spec.tests.find((test) => test.id === id);
          // If any objects in `tests` array have `cleanup` property, add `tests[0].steps` of cleanup to the end of the object's `steps` array.
          if (test.cleanup) {
            // If `cleanup` is a relative path, resolve it
            if (
              config.relativePathBase === "file" &&
              !path.isAbsolute(test.cleanup)
            ) {
              test.cleanup = path.resolve(path.dirname(file), test.cleanup);
            }
            const cleanupContent = fs.readFileSync(test.cleanup).toString();
            const cleanup = JSON.parse(cleanupContent);
            test.steps = test.steps.concat(cleanup.tests[0].steps);
          }
          // Set `id` to new UUID
          id = `${uuid.v4()}`;
          // Set `ignore` to false
          ignore = false;
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
        } else if (line.includes(fileType.testIgnoreStatement)) {
          // Set `ignore` to true
          ignore = true;
        } else if (!ignore) {
          // Test for markup/dynamically generate tests

          // Find test with `id`
          test = spec.tests.find((test) => test.id === id);
          // If test doesn't exist, create it
          if (!test) {
            test = { id, file, steps: [] };
            spec.tests.push(test);
            test = spec.tests.find((test) => test.id === id);
          }
          // If `detectSteps` is false, skip
          if (
            (typeof config.runTests?.detectSteps == "undefined" &&
              typeof test.detectSteps === "undefined") ||
            (config.runTests?.detectSteps === false &&
              typeof test.detectSteps === "undefined") ||
            test.detectSteps === false
          )
            continue;

          log(config, "debug", `line: ${line}`);
          let steps = [];

          fileType.markup.forEach((markup) => {
            // Test for markup
            regex = new RegExp(markup.regex, "g");
            const matches = [];
            markup.regex.forEach((regex) => {
              const match = line.matchAll(regex);
              if (match) matches.push(...match);
            });
            // If no matches, skip
            if (matches.length === 0) return false;
            log(config, "debug", `markup: ${markup.name}`);

            const actionMap = {
              checkLink: {
                action: "checkLink",
                url: "$1",
              },
              goTo: {
                action: "goTo",
                url: "$1",
              },
              find: {
                action: "find",
                selector: "aria/$1",
              },
              saveScreenshot: {
                action: "saveScreenshot",
                path: "$1",
              },
              startRecording: {
                action: "startRecording",
                path: "$1",
              },
              httpRequest: {
                action: "httpRequest",
                url: "$1",
              },
              runShell: {
                action: "runShell",
                command: "$1",
              },
              typeKeys: {
                action: "typeKeys",
                keys: "$1",
              },
            };

            matches.forEach((match) => {
              log(config, "debug", `match: ${JSON.stringify(match, null, 2)}`);

              // If `match` doesn't have a capture group, set it to the entire match
              if (match.length === 1) {
                match[1] = match[0];
              }
              markup.actions.forEach((action) => {
                let step = {};
                if (typeof action === "string") {
                  step = JSON.parse(JSON.stringify(actionMap[action]));
                } else if (action.name) {
                  // TODO v3: Remove this block
                  if (action.params) {
                    step = { action: action.name, ...action.params };
                  } else {
                    step = { action: action.name };
                  }
                } else {
                  step = JSON.parse(JSON.stringify(action));
                }
                step.index = match.index;
                // Substitute variables $n with match[n]
                Object.keys(step).forEach((key) => {
                  if (typeof step[key] !== "string") return;
                  // Replace $n with match[n]
                  step[key] = step[key].replace(/\$[0-9]+/g, (stepMatch) => {
                    const index = stepMatch.substring(1);
                    return match[index];
                  });
                });

                log(config, "debug", `step: ${JSON.stringify(step, null, 2)}`);
                steps.push(step);
              });
            });
          });
          log(config, "debug", `all steps: ${JSON.stringify(steps, null, 2)}`);
          // Order steps by step.index
          steps.sort((a, b) => a.index - b.index);
          // Remove step.index
          steps.forEach((step) => delete step.index);
          log(
            config,
            "debug",
            `cleaned steps: ${JSON.stringify(steps, null, 2)}`
          );
          // Filter out steps that don't pass validation
          steps = steps.filter((step) => {
            const validation = validate(`${step.action}_v2`, step, false);
            if (!validation.valid) {
              log(
                config,
                "warning",
                `Step ${step} isn't a valid step. Skipping.`
              );
              return false;
            }
            return true;
          });
          // Push steps to test
          test.steps.push(...steps);
        }
      }

      // Remove tests with no steps
      spec.tests = spec.tests.filter((test) => test.steps.length > 0);

      // Push spec to specs, if it is valid
      const validation = validate("spec_v2", spec, false);
      if (!validation.valid) {
        log(
          config,
          "warning",
          `Tests from ${file} don't create a valid test specification. Skipping.`
        );
      } else {
        // Resolve paths
        spec = await resolvePaths({config: config, object: spec, filePath: file});
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

/**
 * Loads environment variables from a specified .env file.
 * 
 * @async
 * @param {string} envsFile - Path to the environment variables file.
 * @returns {Promise<Object>} An object containing the operation result.
 * @returns {string} returns.status - "PASS" if environment variables were loaded successfully, "FAIL" otherwise.
 * @returns {string} returns.description - A description of the operation result.
 */
async function loadEnvs(envsFile) {
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
      console.log(JSON.stringify(message, null, 2));
    }
  }
}

function replaceEnvs(stringOrObject) {
  if (!stringOrObject) return stringOrObject;
  if (typeof stringOrObject === "object") {
    // Iterate through object and recursively resolve variables
    Object.keys(stringOrObject).forEach((key) => {
      // Resolve all variables in key value
      stringOrObject[key] = replaceEnvs(stringOrObject[key]);
    });
  } else if (typeof stringOrObject === "string") {
    // Load variable from string
    variableRegex = new RegExp(/\$[a-zA-Z0-9_]+/, "g");
    matches = stringOrObject.match(variableRegex);
    // If no matches, return string
    if (!matches) return stringOrObject;
    // Iterate matches
    matches.forEach((match) => {
      // Check if is declared variable
      value = process.env[match.substring(1)];
      if (value) {
        // If match is the entire string instead of just being a substring, try to convert value to object
        try {
          if (
            match.length === stringOrObject.length &&
            typeof JSON.parse(stringOrObject) === "object"
          ) {
            value = JSON.parse(value);
          }
        } catch {}
        // Attempt to load additional variables in value
        value = replaceEnvs(value);
        // Replace match with variable value
        if (typeof value === "string") {
          // Replace match with value. Supports whole- and sub-string matches.
          stringOrObject = stringOrObject.replace(match, value);
        } else if (typeof value === "object") {
          // If value is an object, replace match with object
          stringOrObject = value;
        }
      }
    });
  }
  return stringOrObject;
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
/**
 * Executes a command in a child process using the `spawn` function from the `child_process` module.
 * @param {string} cmd - The command to execute.
 * @param {string[]} args - The arguments to pass to the command.
 * @param {object} options - The options for the command execution.
 * @param {boolean} options.workingDirectory - Directory in which to execute the command.
 * @param {boolean} options.debug - Whether to enable debug mode.
 * @returns {Promise<object>} A promise that resolves to an object containing the stdout, stderr, and exit code of the command.
 */
async function spawnCommand(cmd, args = [], options) {
  // Set default options
  if (!options) options = {};

  // Set shell (bash/cmd) based on OS
  let shell = "bash";
  let command = ["-c"];
  if (process.platform === "win32") {
    shell = "cmd";
    command = ["/c"];
  }

  // Combine command and arguments
  let fullCommand = [cmd, ...args].join(" ");
  command.push(fullCommand);

  // Set spawnOptions based on OS
  let spawnOptions = {};
  let cleanupNodeModules = false;
  if (process.platform === "win32") {
    spawnOptions.shell = true;
    spawnOptions.windowsHide = true;
  }
  if (options.cwd) {
    spawnOptions.cwd = options.cwd;
  }

  const runCommand = spawn(shell, command, spawnOptions);
  runCommand.on("error", (error) => {});

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

async function inContainer() {
  if (process.env.IN_CONTAINER === "true") return true;
  if (process.platform === "linux") {
    result = await spawnCommand(
      `grep -sq "docker\|lxc\|kubepods" /proc/1/cgroup`
    );
    if (result.exitCode === 0) return true;
  }
  return false;
}

function calculatePercentageDifference(text1, text2) {
  const distance = llevenshteinDistance(text1, text2);
  const maxLength = Math.max(text1.length, text2.length);
  const percentageDiff = (distance / maxLength) * 100;
  return percentageDiff.toFixed(2); // Returns the percentage difference as a string with two decimal places
}

function llevenshteinDistance(s, t) {
  if (!s.length) return t.length;
  if (!t.length) return s.length;

  const arr = [];

  for (let i = 0; i <= t.length; i++) {
    arr[i] = [i];
  }

  for (let j = 0; j <= s.length; j++) {
    arr[0][j] = j;
  }

  for (let i = 1; i <= t.length; i++) {
    for (let j = 1; j <= s.length; j++) {
      arr[i][j] = Math.min(
        arr[i - 1][j] + 1, // deletion
        arr[i][j - 1] + 1, // insertion
        arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1) // substitution
      );
    }
  }

  return arr[t.length][s.length];
}
