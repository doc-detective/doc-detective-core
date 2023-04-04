const { validate } = require("doc-detective-common");
const path = require("path");

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

  // Set filePath
  if (!step.path) {
    // Set path directory
    const dir = config.runTests.mediaDirectory || config.runTests.output || config.output;
    step.path = path.join(dir, `${step.id}.png`);
  }

  try {
    await driver.saveScreenshot(step.path);
  } catch (error) {
    // Couldn't save screenshot
    result.status = "FAIL";
    result.description = `Couldn't save screenshot. ${error}`;
    return result;
  }

  // PASS
  return result;
}
