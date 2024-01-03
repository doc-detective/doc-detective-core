const { validate } = require("doc-detective-common");
const { instantiateCursor } = require("./moveTo");
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
  // Set fileName
  step.fileName = path.basename(step.filePath, path.extname(step.filePath));
  
  if (context.app.name === "chrome") {
    config.recording = {};
    // Chrome
    // Get document title
    const documentTitle = await driver.getTitle();
    const originalTab = await driver.getWindowHandle();
    // Set document title to "RECORD_ME"
    await driver.execute(() => (document.title = "RECORD_ME"));
    // Create new tab
    const recorderTab = await driver.createWindow("tab");
    // Switch to new tab
    await driver.switchToWindow(recorderTab.handle);
    await driver.url("chrome://new-tab-page");
    await driver.execute(() => (document.title = "RECORDER"));
    config.recording.tab = await driver.getWindowHandle();

    // Start recording
    const recorder = await driver.execute((fileName) => {
      let stream;
      let recorder;
      const displayMediaOptions = {
        video: {
          displaySurface: "browser",
        },
        audio: {
          suppressLocalAudioPlayback: false,
        },
        preferCurrentTab: false,
        selfBrowserSurface: "exclude",
        systemAudio: "include",
        surfaceSwitching: "include",
        monitorTypeSurfaces: "include",
      };
      async function startCapture(displayMediaOptions) {
        try {
          const captureStream = await navigator.mediaDevices.getDisplayMedia(
            displayMediaOptions
          );
          return captureStream;
        } catch (err) {
          console.error(`Error: ${err}`);
          return null;
        }
      }
      async function captureAndDownload() {
        stream = await startCapture(displayMediaOptions);
        if (stream) {
          await recordStream(stream);
        }
        return stream;
      }
      async function recordStream(stream) {
        window.recorder = new MediaRecorder(stream, { mimeType: "video/webm" }); // or 'video/mp4'
        let data = [];

        window.recorder.ondataavailable = (event) => data.push(event.data);
        window.recorder.start();

        let stopped = new Promise((resolve, reject) => {
          window.recorder.onstop = resolve;
          window.recorder.onerror = (event) => reject(event.name);
        });

        await stopped;

        let blob = new Blob(data, { type: "video/webm" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = `${fileName}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      }
      function stopMediaTracks(stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      function stopRecordingAndTracks() {
        if (recorder && recorder.state === "recording") {
          recorder.stop(); // this will trigger the onstop event in recordStream
        }
        // Assuming you have the stream variable accessible here
        stopMediaTracks(stream);
      }
      captureAndDownload();
    }, step.fileName);
    // Switch to original tab
    await driver.switchToWindow(originalTab);
    // Set document title back to original
    await driver.execute((documentTitle) => {
      document.title = documentTitle;
    }, documentTitle);
    // Set recorder
    result.recording = { type: "MediaRecorder", tab: recorderTab.handle };
  } else if (context.app.name === "firefox") {
    // Firefox

    result.status = "SKIP";
    result.description = `Recording is not supported for Chrome.`;
    return result;

    const dimensions = await driver.execute(() => {
      return {
        outerHeight: window.outerHeight,
        outerWidth: window.outerWidth,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        screenX: window.screenX,
        screenY: window.screenY,
        devicePixelRatio: window.devicePixelRatio,
        mozInnerScreenX: window.mozInnerScreenX,
        mozInnerScreenY: window.mozInnerScreenY,
      };
    });

    // compute width of borders
    dimensions.borderWidthX =
      (dimensions.outerWidth - dimensions.innerWidth) / 2;
    // compute absolute page position
    dimensions.innerScreenX =
      dimensions.mozInnerScreenX ||
      dimensions.screenX + dimensions.borderWidthX;
    dimensions.innerScreenY =
      dimensions.mozInnerScreenY ||
      dimensions.screenY +
        (dimensions.outerHeight - dimensions.innerHeight) -
        dimensions.borderWidthX;

    const recordingSettings = {
      scale: dimensions.devicePixelRatio,
      width: dimensions.mozInnerScreenX
        ? dimensions.innerWidth
        : dimensions.innerWidth - dimensions.borderWidthX, //dimensions.innerWidth,
      height: dimensions.mozInnerScreenY
        ? dimensions.innerHeight
        : dimensions.innerHeight - 2, //dimensions.innerHeight,
      x: dimensions.innerScreenX, //innerScreenX,
      y: dimensions.innerScreenY, //innerScreenY,
      fps: step.fps,
    };

    try {
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
        `scale=w=iw/${recordingSettings.scale}:h=-1,crop=out_w=${recordingSettings.width}:out_h=${recordingSettings.height}:x=${recordingSettings.x}:y=${recordingSettings.y},format=yuv420p`,
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

      // Instantiate cursor
      await instantiateCursor(driver);

      // Start recording
      const ffmpegProcess = spawn(ffmpegPath, args);
      ffmpegProcess.stdin.setEncoding("utf8");

      // // Output stdout, stderr, and exit code
      // ffmpegProcess.stdout.on("data", (data) => {
      //   console.log(`stdout: ${data}`);
      // });
      // ffmpegProcess.stderr.on("data", (data) => {
      //   console.log(`stderr: ${data}`);
      // });
      // ffmpegProcess.on("close", (code) => {
      //   console.log(`child process exited with code ${code}`);
      // });

      result.recording = ffmpegProcess;
    } catch (error) {
      // Couldn't save screenshot
      result.status = "FAIL";
      result.description = `Couldn't start recording. ${error}`;
      return result;
    }
  }

  // PASS
  return result;
}
