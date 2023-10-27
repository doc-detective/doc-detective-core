const { validate } = require("doc-detective-common");
const path = require("path");
const fs = require("fs");

exports.saveScreenshot = saveScreenshot;

async function saveScreenshot(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Saved screenshot.",
  };

  // Validate step payload
  isValidStep = validate("saveScreenshot_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Set file name
  step.path = step.path || `${step.id}.png`;

  // Set path directory
  const dir =
    step.directory ||
    config.runTests?.mediaDirectory ||
    config.runTests?.output ||
    config.output;
  // If `dir` doesn't exist, create it
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Set filePath
  filePath = path.join(dir, step.path);

  try {
    await driver.saveScreenshot(filePath);
  } catch (error) {
    // Couldn't save screenshot
    result.status = "FAIL";
    result.description = `Couldn't save screenshot. ${error}`;
    return result;
  }

  // PASS
  return result;
}
