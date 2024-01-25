// const axios = require("axios");
// const { exit } = require("node:process");
// const wdio = require("webdriverio");
// const { spawnCommand } = require("./src/utils");
const { runTests, runCoverage, suggestTests } = require("../src");
const { validate, schemas } = require("doc-detective-common");
const { execCommand, spawnCommand } = require("../src/utils");
const path = require("path");

main();
// const { spawn } = require("child_process");

//     // Start Appium server
//     if (__dirname.includes("node_modules")) {
//       // If running from node_modules
//       appiumPath = path.join(__dirname, "../../../appium");
//     } else {
//       // If running from source
//       appiumPath = path.join(__dirname, "../node_modules/appium");
//     }
//     console.log(appiumPath)
//     appium = spawn("node", [appiumPath]);
// // appium = spawn("appium");
// appium.stdout.on('data', (data) => {
//   console.log(`stdout: ${data}`);
// });

async function main() {
  json = {
    envVariables: "",
    input: ".",
    output: ".",
    recursive: true,
    logLevel: "debug",
    runTests: {
      input: "dev/dev.spec.json",
      output: ".",
      setup: "",
      cleanup: "",
      contexts: [
        {
          app: {
            name: "chrome",
            options: {
              height: 900,
              width: 1300,
              headless: false,
            },
          },
          platforms: ["linux", "mac", "windows"],
        },
      ],
      recursive: true,
      mediaDirectory: ".",
      downloadDirectory: ".",
    },
    runCoverage: {
      recursive: true,
      input: "test/artifacts/",
      output: ".",
      markup: [],
    },
    suggestTests: {
      recursive: true,
      input: "test/artifacts/doc-content-uncovered.md",
      output: ".",
      markup: [],
    },
    fileTypes: [
      {
        name: "Markdown",
        extensions: [".md"],
        testStartStatementOpen: "[comment]: # (test start",
        testStartStatementClose: ")",
        testIgnoreStatement: "[comment]: # (test ignore)",
        testEndStatement: "[comment]: # (test end)",
        stepStatementOpen: "[comment]: # (step",
        stepStatementClose: ")",
        markup: [
          {
            name: "Hyperlink",
            regex: ["(?<=(?<!!)\\[.*?\\]\\().*?(?=\\))"],
            actions: [
              {
                name: "checkLink",
                params: {
                  origin: "https://doc-detective.com",
                },
              },
            ],
          },
          {
            name: "Image",
            regex: ["(?<=\\!\\[.*?\\]\\().*?(?=\\))"],
            actions: [
              {
                name: "saveScreenshot",
                params: {
                  directory: "dev",
                  maxVariation: 5,
                  overwrite: "byVariation",
                }
              },
            ],
          },
          {
            name: "Navigation link",
            regex: ["(?<=([Oo]pen|[Cc]lick) (?<!!)\\[[\\w\\s]*\\]\\().*?(?=\\))"],
            actions: [
              {
                name: "goTo",
                params: {
                  origin: "https://doc-detective.com",
                },
              },
            ],
          },
          {
            name: "Onscreen text",
            regex: ["(?<=\\*\\*)[\\w|\\s]+?(?=\\*\\*)"],
            actions: ["find"],
          },
        ],
      },
    ],
    integrations: {},
    telemetry: {
      send: false,
      userId: "Doc Detective",
    },
  };
  // console.log(json);
  result = await runTests(json);
  console.log(JSON.stringify(result, null, 2));
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
      let resp = await axios.get("http://localhost:4723/sessions");
      if (resp.status === 200) isReady = true;
    } catch {}
  }
  return isReady;
}

// Perform tests through Appium drivers.
// Driver reference: https://appium.github.io/appium/docs/en/2.0/quickstart/test-js/
async function runTests_old() {
  // Define driver capabilities.
  // TODO: Build out variety of supported caps
  // Firefox
  const caps_firefox = {
    platformName: "windows",
    "appium:automationName": "Gecko",
    browserName: "MozillaFirefox",
    "moz:firefoxOptions": {
      // Reference: https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
      args: [
        // Reference: https://wiki.mozilla.org/Firefox/CommandLineOptions
        // "-height=800",
        // "-width=1200",
        // "-headless"
      ],
      // "binary": ""
    },
  };
  // Chrome
  const caps_chrome = {
    platformName: "windows",
    "appium:automationName": "Chromium",
    browserName: "chrome",
    "goog:chromeOptions": {
      // Reference: https://chromedriver.chromium.org/capabilities#h.p_ID_102
      args: [
        // Reference: https://peter.sh/experiments/chromium-command-line-switches/
        // "window-size=1200,800",
        // "headless"
      ],
      // "binary": ""
    },
  };
  // const caps_chrome = { "platformName": "windows", "appium:automationName": "Chromium", "browserName": "Chrome", "appium:newCommandTimeout": 3600, "appium:connectHardwareKeyboard": true }
  const driver = await wdio.remote({
    protocol: "http",
    hostname: "localhost",
    port: 4723,
    path: "/",
    capabilities: caps_firefox,
  });

  try {
    // Run through all browser-based actions.
    // Go to URL
    await driver.url("https://www.duckduckgo.com");

    await driver.pause(1000);
    await driver.deleteSession();
    exit();

    // Find element
    // Selector reference: https://webdriver.io/docs/selectors/
    const searchInput = await driver.$("#search_form_input_homepage");

    // Type keys
    await searchInput.setValue("WebdriverIO");
    // TODO: https://webdriver.io/docs/api/browser/action#key-input-source

    // TODO: Match element text

    // Click element
    const searchButton = await driver.$("#search_button_homepage");
    await searchButton.click();

    // Move mouse
    // TODO: https://webdriver.io/docs/api/browser/action#pointer-input-source

    // Scroll viewport
    await driver.scroll();
    // TODO: https://webdriver.io/docs/api/browser/action#wheel-input-source

    // Save screenshot
    await driver.saveScreenshot("./screenshot.png");

    // Compare screenshots
    // TODO: https://appium.io/docs/en/writing-running-appium/image-comparison/

    // Find template image in screenshot
    // TODO: https://appium.io/docs/en/writing-running-appium/image-comparison/

    // Start recording
    // ! Appium: iOS/Android
    // await driver.startRecordingScreen({
    //     timeLimit: 360
    // });
    // ? RecordRTC.js: Chrome/Firefox/Safari/Opera
    // TODO: https://www.npmjs.com/package/recordrtc
    // ? Native Windows/macOS/Linux

    // Stop recording
    // ! Appium: iOS/Android
    // const recording = await driver.stopRecordingScreen();
    // ? RecordRTC.js: Chrome/Firefox/Safari/Opera
    // ? Native Windows/macOS/Linux

    // Wait
    await driver.pause(10000);

    // TODO: Evaluate other Appium-supported actions
  } finally {
    // End driver session.
    await driver.deleteSession();
  }
}
