const { validate } = require("doc-detective-common");
const { spawnCommand } = require("../utils");

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
  const commandResult = await spawnCommand(step.command, step.args);
  result.stdout = commandResult.stdout.replace(/\r$/, "");
  result.stderr = commandResult.stderr.replace(/\r$/, "");
  result.exitCode = commandResult.exitCode;

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

  return result;
}
