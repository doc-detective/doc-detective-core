const { validate } = require("doc-detective-common");
const { log } = require("../utils");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

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
    result.status = "SKIPPED";
    result.description = `Recording isn't started.`;
    return result;
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
      const endMessage = `Finished processing file: ${config.recording.targetPath}`;
      const downloadPath = `${config.recording.downloadPath}`;
      const ffmpeg = exec(
        `${ffmpegPath} -y -i ${downloadPath} -pix_fmt yuv420p ${
          path.extname(config.recording.targetPath) === ".gif"
            ? `-vf scale=iw:-1:flags=lanczos`
            : ""
        } ${config.recording.targetPath}`,
      ).on("close", () => {
        if (config.recording.targetPath !== downloadPath) {
          // Delete the downloaded file
          fs.unlinkSync(downloadPath);
          log(config, "debug", endMessage);
        }
      });
    } else {
      // FFMPEG
      // config.recording.stdin.write("q");
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
