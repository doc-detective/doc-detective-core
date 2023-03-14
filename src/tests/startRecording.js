const { validate } = require("../../../doc-detective-common");
const path = require("path");

exports.startRecording = startRecording;

async function startRecording(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Started recording.",
  };

  // Validate step payload
  isValidStep = validate("startRecording_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Set filePath
  if (!step.filePath) {
    step.filePath = path.join(config.mediaDirectory, `${step.id}.mp4`);
  }

  try {
    // await driver.startRecording(step.filePath);
  } catch (error) {
    // Couldn't save screenshot
    result.status = "FAIL";
    result.description = `Couldn't save screenshot. ${error}`;
    return result;
  }

  // PASS
  return result;
}
