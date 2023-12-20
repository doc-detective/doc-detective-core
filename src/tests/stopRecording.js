const { validate } = require("doc-detective-common");
const path = require("path");

exports.stopRecording = stopRecording;

async function stopRecording(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Stopped recording.",
  };

  // Validate step payload
  isValidStep = validate("stopRecording_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Skip if recording is not started
  if (!config.recording) {
    result.status = "SKIP";
    result.description = `Recording is not started.`;
    return result;
  }

  try {
    config.recording.stdin.write("q");
    // await driver.startRecording(step.filePath);
  } catch (error) {
    // Couldn't stop recording
    result.status = "FAIL";
    result.description = `Couldn't stop recording. ${error}`;
    return result;
  }

  // PASS
  return result;
}
