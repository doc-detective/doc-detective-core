const { validate, resolvePaths } = require("doc-detective-common");
const {
  spawnCommand,
  log,
  calculatePercentageDifference,
} = require("../utils");
const { runShell } = require("./runShell");
const fs = require("fs");
const path = require("path");
const os = require("os");

exports.runCode = runCode;

// Create a temporary script file
function createTempScript(code, language) {
  let extension;
  switch (language) {
    case "python":
    case "py":
      extension = ".py";
      break;
    case "javascript":
    case "js":
    case "node":
      extension = ".js";
      break;
    case "bash":
      extension = ".sh";
      break;
    default:
      extension = "";
  }
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `doc-detective-${Date.now()}${extension}`);
  try {
    fs.writeFileSync(tmpFile, code);
  } catch (error) {
    result.status = "FAIL";
    result.description = `Failed to create temporary script: ${error.message}`;
    return result;
  }
  return tmpFile;
}

// Run gather, compile, and run code.
async function runCode(config, step) {
  const result = {
    status: "PASS",
    description: "Executed code.",
    exitCode: "",
    stdout: "",
    stderr: "",
  };

  // Validate step object
  const isValidStep = validate("runCode_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Create temporary script file
  let scriptPath = createTempScript(step.code, step.language);
  log(config, "debug", `Created temporary script at: ${scriptPath}`);

  try {
    if (!step.command) {
      step.command =
        step.language.toLowerCase() === "python"
          ? "python"
          : step.language.toLowerCase() === "javascript"
          ? "node"
          : "bash";
    }
    const command = step.command;
    // Make sure the command is available
    const commandExists = await spawnCommand(command, ["--version"]);
    if (commandExists.exitCode !== 0) {
      result.status = "FAIL";
      result.description = `Command ${command} is unavailable. Make sure it's installed and in your PATH.`;
      return result;
    }

    // if Windows and command is bash
    if (os.platform() === "win32" && command === "bash") {
      result.status = "FAIL";
      result.description = `runCode currently doesn't support bash on Windows. Use a different command, a different language, or a runShell step.`;
      return result;
    }

    // Prepare shell command based on language
    const shellStep = {
      ...step,
      action: "runShell",
      command:
        step.language.toLowerCase() === "python"
          ? "python"
          : step.language.toLowerCase() === "javascript"
          ? "node"
          : "bash",
      args: [scriptPath, ...step.args],
    };
    if (step.code) delete shellStep.code;
    if (step.language) delete shellStep.language;
    if (step.file) delete shellStep.file;
    if (step.group) delete shellStep.group;

    // Execute script using runShell
    const shellResult = await runShell(config, shellStep);

    // Copy results
    result.status = shellResult.status;
    result.description = shellResult.description;
    result.stdout = shellResult.stdout;
    result.stderr = shellResult.stderr;
    result.exitCode = shellResult.exitCode;
  } catch (error) {
    result.status = "FAIL";
    result.description = error.message;
  } finally {
    // Clean up temporary script file
    try {
      fs.unlinkSync(scriptPath);
      log(config, "debug", `Removed temporary script: ${scriptPath}`);
    } catch (error) {
      log(config, "warn", `Failed to remove temporary script: ${scriptPath}`);
    }
  }

  return result;
}

// If run directly, perform runCode
if (require.main === module) {
  const config = {
    logLevel: "debug",
  };
  const step = {
    action: "runCode",
    code: `print("Hello, world!")`,
    language: "python",
  };
  runCode(config, step)
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.error(error);
    });
}
