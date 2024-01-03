const { validate } = require("doc-detective-common");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
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
      // Wait for file to be in download path
      await driver.waitUntil(async () => {
        return fs.existsSync(config.recording.downloadPath);
      });
      // Close recording tab
      await driver.closeWindow();
      await driver.switchToWindow(currentTab);

      // Identify if the file needs to be converted. If so, convert it.
      if (
        path.extname(config.recording.downloadPath) !==
        path.extname(config.recording.targetPath)
      ) {
        // TODO: Set video format options
        // let vf = "";
        // if (path.extname(config.recording.targetPath) === ".gif") {
        //   vf = "fps=30,scale=-1:-1:flags=lanczos";
        // }
        // Convert file
        const ffmpeg = spawn(ffmpegPath, [
          "-y",
          "-i",
          config.recording.downloadPath,
          "-max_muxing_queue_size 9999",
          config.recording.targetPath,
        ]);
      } else {
        // If file already exists, delete it
        if (fs.existsSync(config.recording.targetPath)) {
          await fs.promises.unlink(config.recording.targetPath);
        }
        // Move file from download path to target path
        await fs.promises.rename(
          config.recording.downloadPath,
          config.recording.targetPath
        );
      }
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
