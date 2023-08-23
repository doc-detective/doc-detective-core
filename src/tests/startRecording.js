const { validate } = require("doc-detective-common");
const path = require("path");
const OBSWebSocket = require("obs-websocket-js").default;

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
    // TODO: JS-based in-browser recording
    //   await driver.setTimeout({ script: 5000 })
    //   const execResult = await driver.execute((a, b, c, d) => {
    //     return 15
    // }, 1, 2, 3, 4)
    //   console.log(execResult);
    // TODO: OBS-based native app recording
    const obs = new OBSWebSocket();
    // TODO: Set password from config
    const { obsWebSocketVersion, negotiatedRpcVersion } = await obs.connect(
      "ws://127.0.0.1:4455",
      "doc-detective"
    );
    log(
      config,
      "debug",
      `Connected to server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`
    );

    // TODO: Appium-based mobile recording
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
