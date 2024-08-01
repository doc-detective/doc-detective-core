const { validate, resolvePaths } = require("doc-detective-common");
const { spawnCommand, log, calculatePercentageDifference } = require("../utils");
const fs = require("fs");
const path = require("path");

exports.runShell = runShell;

// Run a shell command.
async function runShell(config, step) {
  // Promisify and execute command
  const result = {
    status: "PASS",
    description: "Executed command.",
    exitCode: "",
    stdout: "",
    stderr: "",
  };

  // Validate step object
  const isValidStep = validate("runShell_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Execute command
  const timeout = step.timeout;
  const options = {};
  if (step.workingDirectory) options.cwd = step.workingDirectory;
  const commandPromise = spawnCommand(step.command, step.args, options);
  let timeoutId;
  const timeoutPromise = new Promise((resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Command timed out after ${timeout} milliseconds`));
    }, timeout);
  });

  try {
    // Wait for command to finish or timeout
    const commandResult = await Promise.race([commandPromise, timeoutPromise]);
    clearTimeout(timeoutId);
    result.stdout = commandResult.stdout.replace(/\r$/, "");
    result.stderr = commandResult.stderr.replace(/\r$/, "");
    result.exitCode = commandResult.exitCode;
  } catch (error) {
    result.status = "FAIL";
    result.description = error.message;
    return result;
  }

  // Evaluate exit code
  if (!step.exitCodes.includes(result.exitCode)) {
    result.status = "FAIL";
    result.description = `Returned exit code ${
      result.exitCode
    }. Expected one of ${JSON.stringify(step.exitCodes)}`;
  }

  // Evaluate stdout and stderr
  // If step.output starts and ends with `/`, treat it as a regex
  if (step.output) {
    if (step.output.startsWith("/") && step.output.endsWith("/")) {
      const regex = new RegExp(step.output.slice(1, -1));
      if (!regex.test(result.stdout) && !regex.test(result.stderr)) {
        result.status = "FAIL";
        result.description = `Couldn't find expected output (${step.output}) in actual output (stdout or stderr).`;
      }
    } else {
      if (
        !result.stdout.includes(step.output) &&
        !result.stderr.includes(step.output)
      ) {
        result.status = "FAIL";
        result.description = `Couldn't find expected output (${step.output}) in actual output (stdout or stderr).`;
      }
    }
  }

  // Set environment variables from command output
  for (const variable of step.setVariables) {
    const regex = new RegExp(variable.regex);
    const matchStdout = result.stdout.match(regex);
    const matchStderr = result.stderr.match(regex);
    if (matchStdout) {
      process.env[variable.name] = matchStdout[0];
    } else if (matchStderr) {
      process.env[variable.name] = matchStderr[0];
    } else {
      result.status = "FAIL";
      result.description = `Couldn't set '${variable.name}' environment variable. The regex (${variable.regex}) wasn't found in the command output (stdout or stderr).`;
    }
  }

  // Check if command output is saved to a file
  if (step.savePath) {
    const dir = path.dirname(step.path);
    // If `dir` doesn't exist, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Set filePath
    let filePath = step.path;
    log(config,"debug", `Saving output to file: ${filePath}`)

    // Check if file already exists
    if (!fs.existsSync(filePath)) {
      // Doesn't exist, save output to file
      fs.writeFileSync(filePath, result.stdout)
    } else {
      if (step.overwrite == "false") {
        // File already exists
        result.description =
          result.description + ` Didn't save output. File already exists.`;
      }

      // Read existing file
      const existingFile = fs.readFileSync(filePath, "utf8");

      // Calculate percentage diff between existing file content and command output content, not length
      const percentDiff = calculatePercentageDifference(
        existingFile,
        result.stdout
      );
      log(config,"debug", `Percentage difference: ${percentDiff}%`);

      if (percentDiff > step.maxVariation) {
        if (step.overwrite == "byVariation") {
          // Overwrite file
          fs.writeFileSync(filePath, result.stdout);
        }
        result.status = "FAIL";
        result.description =
          result.description +
          ` The percentage difference between the existing file content and command output content (${percentDiff}%) is greater than the max accepted variation (${step.maxVariation}%).`;
        return result;
      }

      if (step.overwrite == "true") {
        // Overwrite file
        fs.writeFileSync(filePath, result.stdout);
      }
    }
  }

  return result;
}
