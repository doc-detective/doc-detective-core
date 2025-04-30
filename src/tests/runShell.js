const { validate } = require("doc-detective-common");
const {
  spawnCommand,
  log,
  calculatePercentageDifference,
} = require("../utils");
const fs = require("fs");
const path = require("path");

exports.runShell = runShell;

// Run a shell command.
async function runShell({ config, step }) {
  // Promisify and execute command
  step = {
    ...step,
    result: "PASS",
    resultDescription: "Executed command.",
    outputs: {
      exitCode: "",
      stdio: {
        stdout: "",
        stderr: "",
      },
    },
  };

  // Validate step object
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    step.result = "FAIL";
    step.resultDescription = `Invalid step definition: ${isValidStep.errors}`;
    return step;
  }
  // Accept coerced and defaulted values
  step = isValidStep.object;
  // Resolve to object
  if (typeof step.runShell === "string") {
    step.runShell = { command: step.runShell };
  }
  // Set default values
  step.runShell = {
    ...step.runShell,
    exitCodes: step.runShell.exitCodes || [0],
    args: step.runShell.args || [],
    workingDirectory: step.runShell.workingDirectory || ".",
    maxVariation: step.runShell.maxVariation || 0,
    overwrite: step.runShell.overwrite || "aboveVariation",
    timeout: step.runShell.timeout || 60000,
  };

  // Execute command
  const timeout = step.runShell.timeout;
  const options = {};
  if (step.runShell.workingDirectory)
    options.cwd = step.runShell.workingDirectory;
  const commandPromise = spawnCommand(
    step.runShell.command,
    step.runShell.args,
    options
  );
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
    step.outputs.stdio.stdout = commandResult.stdout.replace(/\r$/, "");
    step.outputs.stdio.stderr = commandResult.stderr.replace(/\r$/, "");
    step.outputs.exitCode = commandResult.exitCode;
  } catch (error) {
    step.result = "FAIL";
    step.resultDescription = error.message;
    return step;
  }

  // Evaluate exit code
  if (!step.runShell.exitCodes.includes(step.outputs.exitCode)) {
    step.result = "FAIL";
    step.resultresultDescription = `Returned exit code ${
      step.outputs.exitCode
    }. Expected one of ${JSON.stringify(step.runShell.exitCodes)}`;
  }

  // Evaluate stdout and stderr
  // If step.runShell.stdio starts and ends with `/`, treat it as a regex
  if (step.runShell.stdio) {
    if (
      step.runShell.stdio.startsWith("/") &&
      step.runShell.stdio.endsWith("/")
    ) {
      const regex = new RegExp(step.runShell.stdio.slice(1, -1));
      if (!regex.test(step.outputs.stdio.stdout) && !regex.test(step.outputs.stdio.stderr)) {
        step.result = "FAIL";
        step.resultDescription = `Couldn't find expected output (${step.runShell.stdio}) in actual output (stdout or stderr).`;
      }
    } else {
      if (
        !step.outputs.stdio.stdout.includes(step.runShell.stdio) &&
        !step.outputs.stdio.stderr.includes(step.runShell.stdio)
      ) {
        step.result = "FAIL";
        step.resultDescription = `Couldn't find expected output (${step.runShell.stdio}) in stdio (stdout or stderr).`;
      }
    }
  }

  // Check if command output is saved to a file
  if (step.runShell.path) {
    const dir = path.dirname(step.runShell.path);
    // If `dir` doesn't exist, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Set filePath
    let filePath = step.runShell.path;
    log(config, "debug", `Saving stdio to file: ${filePath}`);

    // Check if file already exists
    if (!fs.existsSync(filePath)) {
      // Doesn't exist, save output to file
      fs.writeFileSync(filePath, step.outputs.stdio.stdout);
    } else {
      if (step.runShell.overwrite == "false") {
        // File already exists
        step.resultDescription =
          step.resultDescription + ` Didn't save output. File already exists.`;
      }

      // Read existing file
      const existingFile = fs.readFileSync(filePath, "utf8");

      // Calculate percentage diff between existing file content and command output content, not length
      const percentDiff = calculatePercentageDifference(
        existingFile,
        step.outputs.stdio.stdout
      );
      log(config, "debug", `Percentage difference: ${percentDiff}%`);

      if (percentDiff > step.runShell.maxVariation) {
        if (step.runShell.overwrite == "aboveVariation") {
          // Overwrite file
          fs.writeFileSync(filePath, step.outputs.stdio.stdout);
        }
        step.result = "FAIL";
        step.resultDescription =
          step.resultDescription +
          ` The percentage difference between the existing file content and command output content (${percentDiff}%) is greater than the max accepted variation (${step.runShell.maxVariation}%).`;
        return step;
      }

      if (step.runShell.overwrite == "true") {
        // Overwrite file
        fs.writeFileSync(filePath, step.outputs.stdio.stdout);
      }
    }
  }

  return step;
}
