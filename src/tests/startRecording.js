const { validate } = require("doc-detective-common");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;

exports.startRecording = startRecording;

async function startRecording(config, context, step, driver) {
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
      devicePixelRatio: window.devicePixelRatio,
    };
  });

  // Computer screen dimensions with scaling
  dimensions.scaledScreenX = Math.round(
    dimensions.screenX * dimensions.devicePixelRatio
  );
  dimensions.scaledScreenY = Math.round(
    dimensions.screenY * dimensions.devicePixelRatio
  );
  dimensions.scaledOuterWidth = Math.round(
    dimensions.outerWidth * dimensions.devicePixelRatio
  );
  dimensions.scaledOuterHeight = Math.round(
    dimensions.outerHeight * dimensions.devicePixelRatio
  );
  dimensions.scaledInnerWidth = Math.round(
    dimensions.innerWidth * dimensions.devicePixelRatio
  );
  dimensions.scaledInnerHeight = Math.round(
    dimensions.innerHeight * dimensions.devicePixelRatio
  );

  // Adjust rounded values to the nearest even numbers
  dimensions.scaledOuterWidth += dimensions.scaledOuterWidth % 2;
  dimensions.scaledOuterHeight += dimensions.scaledOuterHeight % 2;
  dimensions.scaledInnerWidth += dimensions.scaledInnerWidth % 2;
  dimensions.scaledInnerHeight += dimensions.scaledInnerHeight % 2;

  // compute width of borders
  dimensions.borderWidth = (dimensions.outerWidth - dimensions.innerWidth) / 2;
  // compute absolute page position
  dimensions.innerScreenX = dimensions.screenX + dimensions.borderWidth;
  dimensions.innerScreenY =
    dimensions.outerHeight -
    dimensions.innerHeight -
    dimensions.borderWidth +
    dimensions.screenY;

  console.log(dimensions);
  const recordingSettings = {
    width: dimensions.scaledOuterWidth, //dimensions.innerWidth,
    height: dimensions.scaledOuterHeight, //dimensions.innerHeight,
    x: dimensions.scaledScreenX, //innerScreenX,
    y: dimensions.scaledScreenY, //innerScreenY,
    fps: step.fps,
  };

  try {
    // Start FFMPEG-based recording

    // Build args
    const args = [
      "-y",
      "-f",
      "gdigrab",
      "-i",
      "desktop",
      "-framerate",
      recordingSettings.fps,
      "-vf",
      `crop=out_w=${recordingSettings.width}:out_h=${recordingSettings.height}:x=${recordingSettings.x}:y=${recordingSettings.y},format=yuv420p`,
      step.filePath,
    ];

    // const args = {
    //   windows: [
    //     "-y",
    //     "-f",
    //     "gdigrab",
    //     "-i",
    //     "desktop",
    //     "-framerate",
    //     recordingSettings.fps,
    //     "-vf",
    //     `crop=out_w=${recordingSettings.width}:out_h=${recordingSettings.height}:x=${recordingSettings.x}:y=${recordingSettings.y}`,
    //     // `crop=${recordingSettings.width}:${recordingSettings.height}:${recordingSettings.x}:${recordingSettings.y}`,
    //     step.filePath,
    //   ],
    //   mac: [
    //     "-y",
    //     "-f",
    //     "avfoundation",
    //     "-framerate",
    //     recordingSettings.fps,
    //     "-i",
    //     "1",
    //     "-vf",
    //     `crop=${recordingSettings.width}:${recordingSettings.height}:${recordingSettings.x}:${recordingSettings.y}`,
    //     step.filePath,
    //   ],
    //   linux: [
    //     "-y",
    //     "-f",
    //     "x11grab",
    //     "-framerate",
    //     recordingSettings.fps,
    //     "-video_size",
    //     `${recordingSettings.width}x${recordingSettings.height}`,
    //     "-i",
    //     `:0.0+${recordingSettings.x},${recordingSettings.y}`,
    //     step.filePath,
    //   ],
    // };

    console.log(args);
    const ffmpegProcess = spawn(ffmpegPath, args);
    ffmpegProcess.stdin.setEncoding("utf8");
    // Output stdout, stderr, and exit code
    ffmpegProcess.stdout.on("data", (data) => {
      console.log(`stdout: ${data}`);
    });
    ffmpegProcess.stderr.on("data", (data) => {
      console.log(`stderr: ${data}`);
    });
    ffmpegProcess.on("close", (code) => {
      console.log(`child process exited with code ${code}`);
    });

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
