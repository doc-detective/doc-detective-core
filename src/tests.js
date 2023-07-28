const kill = require("tree-kill");
const wdio = require("webdriverio");
const { exit } = require("process");
const { log, loadEnvs, spawnCommand } = require("./utils");
const axios = require("axios");
require("geckodriver");
const { goTo } = require("./tests/goTo");
const { findElement } = require("./tests/findElement");
const { runShell } = require("./tests/runShell");
const { checkLink } = require("./tests/checkLink");
const { typeKeys } = require("./tests/typeKeys");
const { wait } = require("./tests/wait");
const { saveScreenshot } = require("./tests/saveScreenshot");
// const { startRecording } = require("./tests/startRecording");
// const { stopRecording } = require("./tests/stopRecording");
const { setVariables } = require("./tests/setVariables");
const { httpRequest } = require("./tests/httpRequest");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const uuid = require("uuid");

exports.runSpecs = runSpecs;
// exports.appiumStart = appiumStart;
// exports.appiumIsReady = appiumIsReady;
// exports.driverStart = driverStart;

// Doc Detective actions that require a driver.
const driverActions = [
  "goTo",
  "find",
  "typeKeys",
  "saveScreenshot",
  // "startRecording",
  // "stopRecording",
];

// Get Appium driver capabilities and apply overrides.
function getDriverCapabilities(config, name, overrides) {
  let capabilities = {};

  // Set Firefox capabilities
  switch (name) {
    case "firefox":
      firefox = config.environment.apps.find((app) => app.name === "firefox");
      if (!firefox) break;
      capabilities = {
        platformName: config.environment.platform,
        "appium:automationName": "Gecko",
        browserName: "MozillaFirefox",
        "moz:firefoxOptions": {
          // Reference: https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
          args: [
            // Reference: https://wiki.mozilla.org/Firefox/CommandLineOptions
            // "-height=800",
            // "-width=1200",
            "-headless",
          ],
          binary: overrides.path || firefox.path,
        },
      };
      break;
    case "chrome":
      // Set Chrome(ium) capabilities
      if (config.environment.apps.find((app) => app.name === "chrome")) {
        chrome = config.environment.apps.find((app) => app.name === "chrome");
        if (!chrome) break;
        chromedriver = config.environment.apps.find((app) => app.name === "chromedriver");
        capabilities = {
          platformName: config.environment.platform,
          "appium:automationName": "Chromium",
          "appium:executable": overrides.driverPath || chromedriver.path,
          browserName: "chrome",
          "goog:chromeOptions": {
            // Reference: https://chromedriver.chromium.org/capabilities#h.p_ID_102
            args: [
              // Reference: https://peter.sh/experiments/chromium-command-line-switches/
              // "window-size=1200,800",
              "headless",
              "disable-gpu",
            ],
            binary: overrides.path || chrome.path,
          },
        };
      }
      break;
    default:
      break;
  }

  return capabilities;
}

// Check if any specs/tests/steps require drivers.
function isAppiumRequired(specs) {
  let appiumRequired = false;
  specs.forEach((spec) => {
    // Check if contexts are defined at the spec level.
    if (spec.contexts && spec.contexts.length > 0) appiumRequired = true;
    spec.tests.forEach((test) => {
      // Check if contexts are defined at the test level.
      if (test.contexts && test.contexts.length > 0) appiumRequired = true;
      test.steps.forEach((step) => {
        // Check if test includes actions that require a driver.
        if (driverActions.includes(step.action)) appiumRequired = true;
      });
    });
  });
  return appiumRequired;
}

// Check if any specs/tests/steps require OBS.
function isObsRequired(specs) {
  let obsRequired = false;
  specs.forEach((spec) => {
    // Check if contexts are defined at the spec level.
    spec.tests.forEach((test) => {
      // Check if contexts are defined at the test level.
      test.steps.forEach((step) => {
        // Check if test includes actions that require a driver.
        // TODO: When supporting more recording options than OBS, enhance this check based on recording conditions
        if (step.action === "startRecording") obsRequired = true;
      });
    });
  });
  return obsRequired;
}

// // TODO: Finish
// // Check if OBS is running. If not, start it.
// async function obsStart() {
//   await exec("pgrep obs");
// }

// // TODO: Finish
// // Connect to OBS
// // Reference: https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md
// async function obsConnect() {
//   obsStart();
//   const obs = new OBSWebSocket();
//   try {
//       const {
//           obsWebSocketVersion,
//           negotiatedRpcVersion
//       } = await obs.connect('ws://127.0.0.1:4455', 'T3AUEXrjK3xrPegG');
//       console.log(`Connected to server ${obsWebSocketVersion} (using RPC ${negotiatedRpcVersion})`)
//       // If doesn't already exist, create scene
//       // Set active scene
//       // Create input
//       // const inputID = await obs.call("CreateInput",{sceneName: "Doc Detective",inputName:"Doc Detective Capture",inputSettings:{ }});
//       // Configure input
//       // console.log(await obs.call("GetInputDefaultSettings",{inputKind:"window_capture"}))
//       console.log(await obs.call("SetInputSettings", { inputName: "Window Capture", inputSettings: { window: 'obs-websocket/protocol.md at master · obsproject/obs-websocket - Google Chrome:Chrome_WidgetWin_1:chrome.exe' } }));
//       // console.log(await obs.call("SetInputSettings", { inputName: "Window Capture", inputSettings: { window: 'obs-websocket/protocol.md at master · obsproject/obs-websocket - Google Chrome:Chrome_WidgetWin_1:chrome.exe' } }));
//       return obs;
//   } catch (error) {
//       console.error('Failed to connect', error.code, error.message);
//   }
// }

// Check if context is supported by current platform and available apps
function isSupportedContext(context, apps, platform) {
  // Check apps
  let isSupportedApp = true;
  if (context.app.name)
    isSupportedApp = apps.find(
      (app) => app.name === context.app.name && app.path
    );
  // Check path
  let isSupportedPath = true;
  if (context.app.path) isSupportedPath = fs.existsSync(context.app.path);
  // Check platform
  const isSupportedPlatform = context.platforms.includes(platform);
  // Return boolean
  if (isSupportedApp && isSupportedPath && isSupportedPlatform) {
    return true;
  } else {
    return false;
  }
}

// Define default contexts based on config.runTests.contexts, then using a fallback strategy of Chrome(ium) and Firefox.
// TODO: Update with additional browsers as they are supported.
function getDefaultContexts(config) {
  const contexts = [];
  const apps = config.environment.apps;
  const platform = config.environment.platform;
  // Check if contexts are defined in config
  if (config.runTests.contexts) {
    // Check if contexts are supported
    config.runTests.contexts.forEach((context) => {
      if (isSupportedContext(context, apps, platform)) {
        contexts.push(context);
      }
    });
  }
  // If no contexts are defined in config, or if none are supported, use fallback strategy
  if (contexts.length === 0) {
    const fallback = ["chrome", "firefox"];
    for (const browser of fallback) {
      const app = apps.find((app) => app.name === browser);
      if (app) {
        contexts.push({
          app,
          platforms: [platform],
        });
      }
    }
  }
  return contexts;
}

// Iterate through and execute test specifications and contained tests.
async function runSpecs(config, specs) {
  // Set initial shorthand values
  const configContexts = getDefaultContexts(config);
  const platform = config.environment.platform;
  const availableApps = config.environment.apps;
  let appium;
  const report = {
    summary: {
      specs: {
        pass: 0,
        fail: 0,
        warning: 0,
        skipped: 0,
      },
      tests: {
        pass: 0,
        fail: 0,
        warning: 0,
        skipped: 0,
      },
      contexts: {
        pass: 0,
        fail: 0,
        warning: 0,
        skipped: 0,
      },
      steps: {
        pass: 0,
        fail: 0,
        warning: 0,
        skipped: 0,
      },
    },
    specs: [],
  };

  // Determine which apps are required
  const appiumRequired = isAppiumRequired(specs);
  const obsRequired = isObsRequired(specs);

  // Warm up Appium
  if (appiumRequired) {
    // Start Appium server
    if (__dirname.includes("node_modules")) {
      // If running from node_modules
      appiumPath = path.join(__dirname, "../../appium");
      appium = spawn("node", [appiumPath]);
    } else {
      // If running from source
      // If Windows, run Appium server with Windows-specific command
      if (platform === "windows") {
        appiumPath = path.join(__dirname, "../node_modules/appium");
        appium = spawn("node", [appiumPath]);
      } else {
        appium = spawn("npm", ["run", "appium"]);
      }
    }
    // appium.stdout.on("data", (data) => {
    //   console.log(`stdout: ${data}`);
    // });
    // appium.stderr.on("data", (data) => {
    //   console.error(`stderr: ${data}`);
    // });
    await appiumIsReady();
    log(config, "debug", "Appium is ready.");
  }

  // Warm up OBS
  // TODO: OBS support
  // if (obsRequired) {
  //   const obs = obsConnect();
  // }

  // Iterate specs
  log(config, "info", "Running test specs.");
  for (const spec of specs) {
    log(config, "debug", `SPEC: ${spec.id}`);

    let specReport = { id: spec.id };
    if (spec.file) specReport.file = spec.file;
    if (spec.description) specReport.description = spec.description;
    specReport.tests = [];

    // Conditionally override contexts
    const specContexts = spec.contexts || configContexts;

    // Iterates tests
    for (const test of spec.tests) {
      log(config, "debug", `TEST: ${test.id}`);

      let testReport = {
        id: test.id,
        contexts: [],
      };
      if (test.description) testReport.description = test.description;

      // Conditionally override contexts
      const testContexts = test.contexts || specContexts;

      // Iterate contexts
      // TODO: Support both serial and parallel execution
      for (const index in testContexts) {
        const context = testContexts[index];
        log(config, "debug", `CONTEXT: ${context.app.name}`);

        let contextReport = {
          app: context.app.name,
          path: context.app.path,
          platform,
          steps: [],
        };

        // Check if current environment supports given contexts
        const supportedContext = isSupportedContext(
          context,
          availableApps,
          platform
        );

        // If context isn't supported, skip it
        if (!supportedContext) {
          let appList = [];
          availableApps.forEach((app) => appList.push(app.name));
          log(
            config,
            "warning",
            `Skipping context. The current platform (${platform}) and available apps (${appList.join(
              ", "
            )}) don't support don't support this context (${JSON.stringify(
              context
            )}).`
          );
          contextReport = { result: { status: "SKIPPED" }, ...contextReport };
          report.summary.contexts.skipped++;
          continue;
        }

        // Define driver capabilities
        // TODO: Support custom apps
        let caps = getDriverCapabilities(config, context.app.name, {
          path: context.app.path,
        });
        log(config, "debug", "CAPABILITIES:");
        log(config, "debug", caps);

        // Instantiate driver
        const driver = await driverStart(caps);

        // Iterates steps
        for (let step of test.steps) {
          // Set step id if not defined
          if (!step.id) step.id = `${uuid.v4()}`;
          log(config, "debug", `STEP: ${step.id}`);

          const stepResult = await runStep(config, step, driver);
          log(
            config,
            "debug",
            `RESULT: ${stepResult.status}, ${stepResult.description}`
          );

          // Add step result to report
          stepReport = {
            result: stepResult.status,
            resultDescription: stepResult.description,
            ...step,
          };
          contextReport.steps.push(stepReport);
          report.summary.steps[stepResult.status.toLowerCase()]++;
        }

        // Parse step results to calc context result

        // If any step fails, context fails
        if (contextReport.steps.find((step) => step.result === "FAIL"))
          contextResult = "FAIL";
        // If any step warns, context warns
        else if (contextReport.steps.find((step) => step.result === "WARNING"))
          contextResult = "WARNING";
        // If all steps skipped, context skipped
        else if (
          contextReport.steps.length ===
          contextReport.steps.filter((step) => step.result === "SKIPPED").length
        )
          contextResult = "SKIPPED";
        // If all steps pass, context passes
        else contextResult = "PASS";

        contextReport = { result: contextResult, ...contextReport };
        testReport.contexts.push(contextReport);
        report.summary.contexts[contextResult.toLowerCase()]++;

        // Close driver
        try {
          await driver.deleteSession();
        } catch {}
      }

      // Parse context results to calc test result

      // If any context fails, test fails
      if (testReport.contexts.find((context) => context.result === "FAIL"))
        testResult = "FAIL";
      // If any context warns, test warns
      else if (
        testReport.contexts.find((context) => context.result === "WARNING")
      )
        testResult = "WARNING";
      // If all contexts skipped, test skipped
      else if (
        testReport.contexts.length ===
        testReport.contexts.filter((context) => context.result === "SKIPPED")
          .length
      )
        testResult = "SKIPPED";
      // If all contexts pass, test passes
      else testResult = "PASS";

      testReport = { result: testResult, ...testReport };
      specReport.tests.push(testReport);
      report.summary.tests[testResult.toLowerCase()]++;
    }

    // Parse test results to calc spec result

    // If any context fails, test fails
    if (specReport.tests.find((test) => test.result === "FAIL"))
      specResult = "FAIL";
    // If any test warns, spec warns
    else if (specReport.tests.find((test) => test.result === "WARNING"))
      specResult = "WARNING";
    // If all tests skipped, spec skipped
    else if (
      specReport.tests.length ===
      specReport.tests.filter((test) => test.result === "SKIPPED").length
    )
      specResult = "SKIPPED";
    // If all contexts pass, test passes
    else specResult = "PASS";

    specReport = { result: specResult, ...specReport };
    report.specs.push(specReport);
    report.summary.specs[specResult.toLowerCase()]++;
  }

  // Close appium server
  if (appium) {
    log(config, "debug", "Closing Appium server");
    kill(appium.pid);
  }

  return report;
}

// Run a specific step
async function runStep(config, step, driver) {
  let actionResult;
  // Load values from environment variables
  step = loadEnvs(step);
  switch (step.action) {
    case "goTo":
      actionResult = await goTo(config, step, driver);
      break;
    case "find":
      actionResult = await findElement(config, step, driver);
      break;
    case "typeKeys":
      actionResult = await typeKeys(config, step, driver);
      break;
    case "saveScreenshot":
      actionResult = await saveScreenshot(config, step, driver);
      break;
    // case "startRecording":
    //   actionResult = await startRecording(config, step, driver);
    //   break;
    // case "stopRecording":
    //   actionResult = await stopRecording(config, step, driver);
    //   break;
    case "wait":
      actionResult = await wait(config, step);
      break;
    case "setVariables":
      actionResult = await setVariables(config, step);
      break;
    case "runShell":
      actionResult = await runShell(config, step);
      break;
    case "checkLink":
      actionResult = await checkLink(config, step);
      break;
    case "httpRequest":
      actionResult = await httpRequest(config, step);
      break;
    default:
      actionResult = { status: "FAIL", description: "Unsupported action." };
      break;
  }
  return actionResult;
}

// Delay execution until Appium server is available.
async function appiumIsReady() {
  let isReady = false;
  while (!isReady) {
    // Retry delay
    // TODO: Add configurable retry delay
    // TODO: Add configurable timeout duration
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      let resp = await axios.get("http://0.0.0.0:4723/sessions");
      if (resp.status === 200) isReady = true;
    } catch {}
  }
  return isReady;
}

// Start the Appium driver specified in `capabilities`.
async function driverStart(capabilities) {
  const driver = await wdio.remote({
    protocol: "http",
    hostname: "0.0.0.0",
    port: 4723,
    path: "/",
    capabilities,
  });
  return driver;
}
