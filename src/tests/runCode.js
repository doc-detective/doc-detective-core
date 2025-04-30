const { validate } = require("doc-detective-common");
const { spawnCommand, log } = require("../utils");
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
    throw new Error(`Failed to create temporary script: ${error.message}`);
  }
  return tmpFile;
}

// Run gather, compile, and run code.
async function runCode({ config, step }) {
  step = {
    ...step,
    result: "PASS",
    resultDescription: "Executed code.",
    outputs: {},
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
  // Set default values
  step.runCode = {
    ...step.runCode,
    exitCodes: step.runCode.exitCodes || [0],
    args: step.runCode.args || [],
    workingDirectory: step.runCode.workingDirectory || ".",
    maxVariation: step.runCode.maxVariation || 0,
    overwrite: step.runCode.overwrite || "aboveVariation",
    timeout: step.runCode.timeout || 60000,
  };

  // Create temporary script file
  let scriptPath;
  try {
    scriptPath = createTempScript(step.runCode.code, step.runCode.language);
  } catch (error) {
    step.result = "FAIL";
    step.resultDescription = error.message;
    return step;
  }
  log(config, "debug", `Created temporary script at: ${scriptPath}`);

  try {
    if (!step.runCode.command) {
      const lang = step.runCode.language.toLowerCase();
      step.runCode.command =
        step.runCode.language === "python"
          ? "python"
          : step.runCode.language === "javascript"
          ? "node"
          : "bash";
    }
    const command = step.runCode.command;
    // Make sure the command is available
    const commandExists = await spawnCommand(command, ["--version"]);
    if (commandExists.exitCode !== 0) {
      step.result = "FAIL";
      step.resultDescription = `Command ${command} is unavailable. Make sure it's installed and in your PATH.`;
      return step;
    }

    // if Windows and command is bash
    if (os.platform() === "win32" && command === "bash") {
      step.result = "FAIL";
      step.resultDescription = `runCode currently doesn't support bash on Windows. Use a different command, a different language, or a runShell step.`;
      return step;
    }

    // Prepare shell command based on language
    const shellStep = {
      runShell: {
        command:
          step.runCode.language.toLowerCase() === "python"
            ? "python"
            : step.runCode.language.toLowerCase() === "javascript"
            ? "node"
            : "bash",
        args: [scriptPath, ...step.runCode.args],
      },
    };
    delete shellStep.runCode;

    // Execute script using runShell
    const shellResult = await runShell({ config: config, step: shellStep });

    // Copy results
    step.result = shellResult.result;
    step.resultDescription = shellResult.resultDescription;
    step.outputs = {...step.outputs, ...shellResult.outputs};
  } catch (error) {
    step.result = "FAIL";
    step.resultDescription = error.message;
  } finally {
    // Clean up temporary script file
    try {
      fs.unlinkSync(scriptPath);
      log(config, "debug", `Removed temporary script: ${scriptPath}`);
    } catch (error) {
      log(config, "warn", `Failed to remove temporary script: ${scriptPath}`);
    }
  }

  return step;
}

// If run directly, perform runCode
if (require.main === module) {
  const config = {
    logLevel: "debug",
  };
  const step = {
    runCode: {
      code: `print("Hello, world!")`,
      language: "python",
    },
  };
  runCode(config, step)
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.error(error);
    });
}
