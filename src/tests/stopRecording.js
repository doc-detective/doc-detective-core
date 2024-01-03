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
    if (config.recording.type === "MediaRecorder") {
      // MediaRecorder

      // Get current tab
      const currentTab = await driver.getWindowHandle();
      // Switch to recording tab
      await driver.switchToWindow(config.recording.tab);
      // Stop recording
      await driver.execute(() => {
        window.recorder.stop();
      });
      // Wait for download to finish
      await driver.pause(5000);
      // Close recording tab
      await driver.closeWindow();
      await driver.switchToWindow(currentTab);
    } else {
      // FFMPEG

      config.recording.stdin.write("q");
      // await driver.startRecording(step.filePath);
    }
  } catch (error) {
    // Couldn't stop recording
    result.status = "FAIL";
    result.description = `Couldn't stop recording. ${error}`;
    return result;
  }

  // PASS
  return result;
}
