const { validate } = require("doc-detective-common");
const path = require("path");
const { spawn } = require("child_process");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
ffmpeg.setFfmpegPath(ffmpegPath);

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
    step.filePath = path.join(
      config.runTests?.mediaDirectory,
      step.path || `${step.id}.mp4`
    );
  }

  const dimensions = await driver.execute(() => {
    return {
      outerHeight: window.outerHeight,
      outerWidth: window.outerWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      screenX: window.screenX,
      screenY: window.screenY,
    };
  });

  // compute width of borders
  const borderWidth = (dimensions.outerWidth - dimensions.innerWidth) / 2;
  // compute absolute page position
  const innerScreenX = dimensions.screenX + borderWidth;
  const innerScreenY = (dimensions.outerHeight - dimensions.innerHeight - borderWidth) + dimensions.screenY;

  const recordingSettings = {
    width: dimensions.innerWidth,
    height: dimensions.innerHeight,
    x: innerScreenX,
    y: innerScreenY,
    fps: step.fps,
  };

  try {
    // Start FFMPEG-based recording
    const args = {
      windows: [
        "-y",
        "-f",
        "gdigrab",
        "-i",
        "desktop",
        "-framerate",
        recordingSettings.fps,
        "-vf",
        `crop=${recordingSettings.width}:${recordingSettings.height}:${recordingSettings.x}:${recordingSettings.y}`,
        step.filePath,
      ],
      mac: [
        "-y",
        "-f",
        "avfoundation",
        "-framerate",
        recordingSettings.fps,
        "-i",
        "1",
        "-vf",
        `crop=${recordingSettings.width}:${recordingSettings.height}:${recordingSettings.x}:${recordingSettings.y}`,
        step.filePath,
      ],
      linux: [
        "-y",
        "-f",
        "x11grab",
        "-framerate",
        recordingSettings.fps,
        "-video_size",
        `${recordingSettings.width}x${recordingSettings.height}`,
        "-i",
        `:0.0+${recordingSettings.x},${recordingSettings.y}`,
        step.filePath,
      ],
    };

    const ffmpegProcess = spawn(ffmpegPath, args[config.environment.platform]);
    ffmpegProcess.stdin.setEncoding("utf8");
    // Output stdout, stderr, and exit code
    // ffmpegProcess.stdout.on("data", (data) => {
    //   console.log(`stdout: ${data}`);
    // });
    // ffmpegProcess.stderr.on("data", (data) => {
    //   console.log(`stderr: ${data}`);
    // });
    // ffmpegProcess.on("close", (code) => {
    //   console.log(`child process exited with code ${code}`);
    // });

    // setTimeout(() => {
    //   ffmpegProcess.stdin.setEncoding("utf8");
    //   ffmpegProcess.stdin.write("q");
    // }, 5000);

    result.recording = ffmpegProcess;
  } catch (error) {
    // Couldn't save screenshot
    result.status = "FAIL";
    result.description = `Couldn't start recording. ${error}`;
    return result;
  }

  // PASS
  return result;
}
