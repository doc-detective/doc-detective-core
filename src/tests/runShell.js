const { validate } = require("doc-detective-common");
const { spawnCommand } = require("../utils");

exports.runShell = runShell;

// Run a shell command.
async function runShell(config, step) {
  // Promisify and execute command
  let result = {
    status: "",
    description: "",
    exitCode: "",
    stdout: "",
    stderr: "",
  };

  // Validate step object
  isValidStep = validate("runShell_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Execute command
  const commandResult = await spawnCommand(step.command, step.args);
  result.stdout = commandResult.stdout;
  result.stderr = commandResult.stderr;
  result.exitCode = commandResult.exitCode;

  // Evaluate result
  if (result.exitCode) {
    result.status = "FAIL";
    result.description = `Error during execution.`;
  } else {
    result.status = "PASS";
    result.description = `Executed command.`;
  }

  return result;
}
