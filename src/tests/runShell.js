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
  if (step.output.startsWith("/") && step.output.endsWith("/")) {
    const regex = new RegExp(step.output.slice(1, -1));
    if (!regex.test(result.stdout) && !regex.test(result.stderr)) {
      result.status = "FAIL";
      result.description = `Couldn't find expected output (${step.output}) in actual output (stdout or stderr).`;
    }
  } else {
    if (!result.stdout.includes(step.output) && !result.stderr.includes(step.output)) {
      result.status = "FAIL";
      result.description = `Couldn't find expected output (${step.output}) in actual output (stdout or stderr).`;
    }
  }

  console.log(result)
  process.exit()

  return result;
}
