const appium = require("appium");
const wdio = require("webdriverio");
const { exit } = require("process");
const { setEnvs, log, timestamp, loadEnvs } = require("./utils");
const axios = require("axios");
const arch = require("arch");
require("geckodriver");
const { goTo } = require("./tests/goTo");
const { findElement } = require("./tests/findElement");
const { runShell } = require("./tests/runShell");
const { checkLink } = require("./tests/checkLink");
const { typeKeys } = require("./tests/typeKeys");
const { wait } = require("./tests/wait");
const { saveScreenshot } = require("./tests/saveScreenshot");
// const { startRecording, stopRecording } = require("./tests/record");
const { httpRequest } = require("./tests/httpRequest");

exports.runSpecs = runSpecs;
// exports.appiumStart = appiumStart;
// exports.appiumIsReady = appiumIsReady;
// exports.driverStart = driverStart;

const driverActions = [
  "goTo",
  "find",
  "typeKeys",
  "saveScreenshot",
  "startRecording",
  "stopRecording",
];

// Driver capabilities.
// TODO: Update for non-Linux platforms
const capabilities = {
  firefox: {
    platformName: "linux",
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
      // "binary": ""
    },
  },
  chrome: {
    platformName: "linux",
    "appium:automationName": "Chromium",
    browserName: "chrome",
    "goog:chromeOptions": {
      // Reference: https://chromedriver.chromium.org/capabilities#h.p_ID_102
      args: [
        // Reference: https://peter.sh/experiments/chromium-command-line-switches/
        // "window-size=1200,800",
        "headless",
        "disable-gpu",
      ],
      // "binary": ""
    },
  },
};

const specs = [
  {
    id: "dev-spec",
    description: "",
    contexts: [
      {
        app: { name: "firefox", path: "" },
        platforms: ["windows", "linux", "mac"],
      },
      {
        app: { name: "chrome", path: "" },
        platforms: ["windows", "linux", "mac"],
      },
    ],
    tests: [
      {
        id: "dev-test",
        description: "",
        saveFailedTestRecordings: true,
        failedTestDirectory: "sample",
        steps: [
          {
            action: "goTo",
            url: "www.duckduckgo.com",
          },
          {
            action: "find",
            selector: "#search_form_input_homepage",
            timeout: 1000,
            // matchText: "Frequently Asked Questions",
            moveTo: true,
            click: true,
            typeKeys: {
              keys: ["shorthair cats", "$ENTER$"],
            },
          },
          {
            action: "wait",
            duration: 2000,
          },
          {
            action: "saveScreenshot",
            filePath: "shorthair-cats.png"
          },
          // {
          //   action: "httpRequest",
          //   url: "https://reqres.in/api/users",
          //   method: "post",
          //   requestData: {
          //     name: "morpheus",
          //     job: "leader",
          //   },
          //   responseData: {
          //     name: "morpheus",
          //     job: "leader",
          //   },
          //   statusCodes: [
          //     200,
          //     201
          //   ]
          // },
          // {
          //   action: "moveMouse",
          //   css: "#gbqfbb",
          //   alignH: "center",
          //   alignV: "center",
          // },
          // {
          //   action: "moveMouse",
          //   css: "[title=Search]",
          //   alignV: "center",
          // },
          // {
          //   action: "type",
          //   css: "[title=Search]",
          //   keys: "kittens",
          //   trailingSpecialKey: "Enter",
          // },
          // {
          //   action: "scroll",
          //   y: 300,
          // },
          // {
          //   action: "screenshot",
          //   filename: "results.png",
          //   matchPrevious: true,
          //   matchThreshold: 0.1,
          // },
        ],
      },
    ],
  },
];

const contexts = [
  {
    app: "chrome",
    platforms: ["windows", "linux", "mac"],
  },
  {
    app: "chrome_mobile",
    platforms: ["ios", "android"],
  },
  {
    app: "firefox",
    platforms: ["windows", "linux", "mac"],
  },
  {
    app: "firefox_mobile",
    platforms: ["android"],
  },
  {
    app: "safari",
    platforms: ["mac"],
  },
  {
    app: "safari_mobile",
    platforms: ["ios"],
  },
  {
    app: "edge",
    platforms: ["windows", "linux", "mac"],
  },
  {
    app: "edge_mobile",
    platforms: ["ios", "android"],
  },
];

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

// Check if context is supported by current platform and available apps
function isSupportedContext(context, apps, platform) {
  // Check apps
  const isSupportedApp = apps.find(
    // TODO: If `app.path` exists, check that path value is valid. If not, return false.
    (app) => app.name === context.app.name && app.path === context.app.path
  );
  // Check platform
  const isSupportedPlatform = context.platforms.includes(platform);
  // Return boolean
  if (isSupportedApp && isSupportedPlatform) {
    return true;
  } else {
    return false;
  }
}

// Iterate through and execute test specifications and contained tests.
async function runSpecs(config, specs) {
  const configContexts = config.contexts;
  // TODO: Move to config definition
  // TODO: Detect instlaled applications
  const availableApps = [
    {
      name: "firefox",
      path: "", // Optional
    },
  ];
  // TODO: Move to config definition
  const architecture = arch();
  // TODO: Move to config definition
  const platform = platformMap[process.platform];
  const appiumRequired = isAppiumRequired(specs);

  // Warm up Appium
  if (appiumRequired) {
    // Start Appium server
    appiumStart();
    await appiumIsReady();
  }

  // Iterate specs
  log(config, "info", "Running test specs.");
  for (const spec of specs) {
    log(config, "debug", `SPEC: ${spec.id}`);
    // Conditionally override contexts
    const specContexts = spec.contexts || configContexts;

    // Iterates tests
    for (const test of spec.tests) {
      log(config, "debug", `TEST: ${test.id}`);

      // Conditionally override contexts
      const testContexts = test.contexts || specContexts;

      // Iterate contexts
      // TODO: Support both serial and parallel execution
      for (const i in testContexts) {
        const context = testContexts[i];
        log(config, "debug", `CONTEXT: ${context.app.name}`);

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
              ""
            )}) don't support don't support this context (${JSON.stringify(
              context
            )}).`
          );
          continue;
        }

        // Define driver capabilities
        // TODO: Support custom apps
        let caps = capabilities[context.app.name];
        // TODO: Support paths for reserved and custom apps
        // if (context.app.path) {
        // }

        // Instantiate driver
        const driver = await driverStart(caps);

        // Set up test
        let pass = 0;
        let warning = 0;
        let fail = 0;

        // Iterates steps
        for (let step of test.steps) {
          log(config, "debug", `STEP: ${step.id}`);
          const stepResult = await runStep(config, step, driver);
          if (stepResult.status === "FAIL") fail++;
          if (stepResult.status === "WARNING") warning++;
          if (stepResult.status === "PASS") pass++;
          log(
            config,
            "debug",
            `RESULT: ${stepResult.status}, ${stepResult.description}`
          );
          if (stepResult.status === "FAIL") {
            fail++;
            continue;
          }
          if (stepResult.status === "WARNING") warning++;
          if (stepResult.status === "PASS") pass++;
        }

        // Calc context result
        // TODO: Handle `SKIPPED` result
        if (fail) {
          context.status = "FAIL";
        } else if (warning) {
          context.status = "WARNING";
        } else if (pass) {
          context.status = "PASS";
        } else {
          log(config, "debug", "ERROR: Couldn't read step results.");
          exit(1);
        }

        // Close driver
        try {
          await driver.deleteSession();
        } catch {}
      }

      // Calc test result
      if (testContexts.find((context) => context.status === "FAIL")) {
        test.status = "FAIL";
      } else if (testContexts.find((context) => context.status === "WARNING")) {
        test.status = "WARNING";
      } else if (testContexts.find((context) => context.status === "PASS")) {
        test.status = "PASS";
      } else {
        log(config, "debug", "ERROR: Couldn't read context results.");
        exit(1);
      }
    }

    // Calc spec result
    if (spec.tests.find((test) => test.status === "FAIL")) {
      spec.status = "FAIL";
    } else if (spec.tests.find((test) => test.status === "WARNING")) {
      spec.status = "WARNING";
    } else if (spec.tests.find((test) => test.status === "PASS")) {
      spec.status = "PASS";
    } else {
      log(config, "debug", "ERROR: Couldn't read test results.");
      exit(1);
    }
  }
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
    case "wait":
      actionResult = await wait(config, step);
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

// Start the Appium server asynchronously.
async function appiumStart() {
  appium.main();
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

const platformMap = {
  darwin: "mac",
  linux: "linux",
  win32: "windows",
};

async function main() {
  let config = {
    logLevel: "debug",
    sequence: "serial",
    mediaDirectory: ".",
    contexts: [
      {
        app: {
          name: "firefox",
          path: "", // Optional
        },
        platforms: ["linux"],
      },
    ],
  };
  await runSpecs(config, specs);
}
main();
