const { validate } = require("doc-detective-common");
const { log } = require("../utils");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

exports.stopRecording = stopRecording;

async function stopRecording({ config, step, driver }) {
  step = {
    ...step,
    result: "PASS",
    resultDescription: "Stopped recording.",
  };

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    step.status = "FAIL";
    step.resultDescription = `Invalid step definition: ${isValidStep.errors}`;
    return step;
  }
  // Accept coerced and defaulted values
  step = isValidStep.object;

  // Skip if recording is not started
  if (!config.recording) {
    step.status = "SKIPPED";
    step.resultDescription = `Recording isn't started.`;
    return step;
  }

  try {
    if (config.recording.type === "MediaRecorder") {
      // MediaRecorder

      // Switch to recording tab
      await driver.switchToWindow(config.recording.tab);
      // Stop recording
      await driver.execute(() => {
        window.recorder.stop();
      });
      // Wait for file to be in download path
      while (!fs.existsSync(config.recording.downloadPath)) {
        await new Promise((r) => setTimeout(r, 1000));
      }
      // Close recording tab
      await driver.closeWindow();

      // Convert the file into the target format/location
      const targetPath = `${config.recording.targetPath}`;
      const downloadPath = `${config.recording.downloadPath}`;
      const endMessage = `Finished processing file: ${config.recording.targetPath}`;
      const ffmpeg = exec(
        `${ffmpegPath} -y -i ${downloadPath} -pix_fmt yuv420p ${
          path.extname(targetPath) === ".gif"
            ? `-vf scale=iw:-1:flags=lanczos`
            : ""
        } ${targetPath}`
      ).on("close", () => {
        if (targetPath !== downloadPath) {
          // Delete the downloaded file
          fs.unlinkSync(downloadPath);
          log(config, "debug", endMessage);
        }
      });
      config.recording = null;
    } else {
      // FFMPEG
      // config.recording.stdin.write("q");
    }
  } catch (error) {
    // Couldn't stop recording
    step.status = "FAIL";
    step.resultDescription = `Couldn't stop recording. ${error}`;
    return step;
  }

  // PASS
  return step;
}
