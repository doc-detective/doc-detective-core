const appium = require("appium");
const wdio = require('webdriverio');
const fs = require("fs");
const { exit, stdout, exitCode } = require("process");
const { setEnvs, log, timestamp, loadEnvs } = require("./utils");
const util = require("util");
const exec = util.promisify(require("child_process").exec);
const axios = require("axios");
const { goTo } = require("./tests/goTo");
const { clickElement } = require("./tests/click");
const { moveMouse } = require("./tests/moveMouse");
const { scroll } = require("./tests/scroll");
const { screenshot } = require("./tests/screenshot");
const { startRecording, stopRecording } = require("./tests/record");
const { httpRequest } = require("./tests/httpRequest");

exports.runSpecs = runSpecs;

const driverActions = [
  "goTo",
  "find",
  "matchText",
  "click",
  "type",
  "moveMouse",
  "scroll",
  "screenshot",
  "startRecording",
  "stopRecording",
];

// Driver capabilities.
// TODO: Update for non-Windows platforms
const capabilities = {
  firefox: {
    "platformName": "windows",
    "appium:automationName": "Gecko",
    "browserName": "MozillaFirefox",
    "moz:firefoxOptions": {
      // Reference: https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
      "args": [
        // Reference: https://wiki.mozilla.org/Firefox/CommandLineOptions
        // "-height=800",
        // "-width=1200",
        // "-headless"
      ],
      // "binary": ""
    }
  },
  chrome: {
    "platformName": "windows",
    "appium:automationName": "Chromium",
    "browserName": "chrome",
    "goog:chromeOptions": {
      // Reference: https://chromedriver.chromium.org/capabilities#h.p_ID_102
      "args": [
        // Reference: https://peter.sh/experiments/chromium-command-line-switches/
        // "window-size=1200,800",
        // "headless"
      ],
      // "binary": ""
    }
  }
}

const specs = [
  {
    id: "dev-spec",
    description: "",
    contexts: ["chrome", "firefox"],
    "tests": [
      {
        "id": "dev-test",
        description: "",
        "saveFailedTestRecordings": true,
        "failedTestDirectory": "sample",
        "steps": [
          {
            "id": "dev-step",
            description: "",
            "action": "goTo",
            "uri": "www.google.com"
          },
          {
            "action": "moveMouse",
            "css": "#gbqfbb",
            "alignH": "center",
            "alignV": "center"
          },
          {
            "action": "moveMouse",
            "css": "[title=Search]",
            "alignV": "center"
          },
          {
            "action": "type",
            "css": "[title=Search]",
            "keys": "kittens",
            "trailingSpecialKey": "Enter"
          },
          {
            "action": "scroll",
            "y": 300
          },
          {
            "action": "screenshot",
            "filename": "results.png",
            "matchPrevious": true,
            "matchThreshold": 0.1
          }
        ]
      }
    ]
  }
]

const contexts = [
  "chrome",
  "chrome_mobile",
  "firefox",
  "firefox_mobile",
  "safari",
  "safari_mobile",
  "ios",
  "android",
  "windows",
  "mac",
  "linux"
]

// Check if any specs/tests/steps require drivers.
function isAppiumRequired(specs) {
  let appiumRequired = false;
  specs.forEach(spec => {
    // Check if contexts are defined at the spec level.
    if (spec.contexts && spec.contexts.length > 0) appiumRequired = true;
    spec.tests.forEach(test => {
      // Check if contexts are defined at the test level.
      if (test.contexts && test.contexts.length > 0) appiumRequired = true;
      test.steps.forEach(step => {
        // Check if test includes actions that require a driver.
        if (driverActions.includes(step.action)) appiumRequired = true;
      })
    })
  })
  return appiumRequired;
}

// main();
// async function main(){
//   console.log(isAppiumRequired(specs));
// }

// Iterate through and execute test specifications and contained tests.
async function runSpecs(config, specs) {

  const appiumRequired = isAppiumRequired(specs);

  if (appiumRequired) {
    // Start Appium server
    appiumStart();
    await appiumIsReady();
  }

  // Instantiate driver
  // TODO: Only instantiate drivre if required by actions
  // TODO: Iterate drivers based on test context values
  const driver = await driverStart(caps_chrome);

  // Iterate tests
  log(config, "info", "Running tests.");
  for (const test of specs.tests) {
    log(config, "debug", `TEST: ${test.id}`);
    let pass = 0;
    let warning = 0;
    let fail = 0;

    // TODO: If browser
    // if (driverRequired) {
    // Instantiate window
    log(config, "debug", "Instantiating window.");
    page = await driver.newWindow();
    // }
    // Iterate through actions
    for (const action of test.actions) {
      log(config, "debug", `ACTION: ${JSON.stringify(action)}`);
      action.result = await runAction(
        config,
        action,
        driver
      );
      action.result = action.result.result;
      if (action.result.status === "FAIL") fail++;
      if (action.result.status === "WARNING") warning++;
      if (action.result.status === "PASS") pass++;
      log(
        config,
        "debug",
        `RESULT: ${action.result.status}. ${action.result.description}`
      );
    }

    // Calc overall test result
    if (fail) {
      test.status = "FAIL";
    } else if (warning) {
      test.status = "WARNING";
    } else if (pass) {
      test.status = "PASS";
    } else {
      log(config, "debug", "Error: Couldn't read test action results.");
      exit(1);
    }

    // Close driver
    try {
      await driver.deleteSession();
    } catch { }
  }
  return tests;
}

async function runAction(config, action, page, videoDetails) {
  let result = {};
  result.result = {};
  switch (action.action) {
    case "goTo":
      result = await goTo(action, page);
      break;
    case "find":
      // Perform sub-action: wait
      if (typeof action.wait === "undefined") action.wait = {};
      action.wait.css = action.css;
      waitResult = await wait(action.wait, page);
      delete action.wait.css;
      if (waitResult.result.status === "FAIL") {
        return waitResult;
      }
      // Perform find
      result = await findElement(action, page);
      if (result.result.status === "FAIL") return result;
      // Perform sub-action: matchText
      if (action.matchText) {
        action.matchText.css = action.css;
        matchResult = await matchText(action.matchText, page);
        delete action.matchText.css;
        result.result.description =
          result.result.description + " " + matchResult.result.description;
        if (matchResult.result.status === "FAIL") {
          result.result.status = "FAIL";
          return result;
        }
      }
      // Perform sub-action: moveMouse
      if (action.moveMouse) {
        action.moveMouse.css = action.css;
        move = await moveMouse(
          action.moveMouse,
          page,
          result.elementHandle,
          config
        );
        delete action.moveMouse.css;
        result.result.description =
          result.result.description + " " + move.result.description;
        if (move.result.status === "FAIL") {
          result.result.status = "FAIL";
          return result;
        }
      }
      // Perform sub-action: click
      if (action.click) {
        action.click.css = action.css;
        click = await clickElement(action.click, result.elementHandle);
        delete action.click.css;
        result.result.description =
          result.result.description + " " + click.result.description;
        if (click.result.status === "FAIL") {
          result.result.status = "FAIL";
          return result;
        }
      }
      // Perform sub-action: type
      if (action.type) {
        action.type.css = action.css;
        type = await typeElement(action.type, result.elementHandle);
        delete action.type.css;
        result.result.description =
          result.result.description + " " + type.result.description;
        if (type.result.status === "FAIL") {
          result.result.status = "FAIL";
        }
      }
      break;
    case "matchText":
      find = await findElement(action, page);
      if (find.result.status === "FAIL") return find;
      result = await matchText(action, page);
      break;
    case "click":
      find = await findElement(action, page);
      if (find.result.status === "FAIL") return find;
      result = await clickElement(action, find.elementHandle);
      break;
    case "type":
      find = await findElement(action, page);
      if (find.result.status === "FAIL") return find;
      result = await typeElement(action, find.elementHandle);
      break;
    case "moveMouse":
      find = await findElement(action, page);
      if (find.result.status === "FAIL") return find;
      result = await moveMouse(action, page, find.elementHandle, config);
      break;
    case "scroll":
      result = await scroll(action, page, config);
      break;
    case "wait":
      result = await wait(action, page);
      break;
    case "screenshot":
      result = await screenshot(action, page, config);
      break;
    case "startRecording":
      result = await startRecording(action, page, config);
      break;
    case "stopRecording":
      result = await stopRecording(videoDetails, config);
      break;
    case "runShell":
      result = await runShell(action);
      break;
    case "checkLink":
      result = await checkLink(action);
      break;
    case "httpRequest":
      result = await httpRequest(action, config);
      break;
  }
  return result;
}

async function checkLink(action) {
  let status;
  let description;
  let result;
  let uri;

  // Load environment variables
  if (action.env) {
    let result = await setEnvs(action.env);
    if (result.status === "FAIL") return { result };
  }
  uri = loadEnvs(action.uri);

  // Validate protocol
  if (uri.indexOf("://") < 0) {
    // Insert https if no protocol present
    uri = `https://${uri}`;
  }

  // Default to 200 status code
  if (!action.statusCodes) {
    action.statusCodes = [200];
  }
  let req = await axios
    .get(uri)
    .then((res) => {
      return { statusCode: res.status };
    })
    .catch((error) => {
      return { error };
    });

  // If request returned an error
  if (req.error) {
    status = "FAIL";
    description = `Invalid or unresolvable URI: ${action.uri}`;
    result = { status, description };
    return { result };
  }

  // Compare status codes
  if (action.statusCodes.indexOf(req.statusCode) >= 0) {
    status = "PASS";
    description = `Returned ${req.statusCode}`;
  } else {
    status = "FAIL";
    description = `Returned ${req.statusCode}. Expected one of ${JSON.stringify(
      action.statusCodes
    )}`;
  }

  result = { status, description };
  return { result };
}

async function runShell(action) {
  let status;
  let description;
  let result;
  let exitCode;
  let command;

  // Set environment variables
  if (action.env) {
    let result = await setEnvs(action.env);
    if (result.status === "FAIL") return { result };
  }

  // Command
  //// Load envs
  command = loadEnvs(action.command);

  // Promisify and execute command
  const promise = exec(command);
  const child = promise.child;
  child.on("close", function (code) {
    exitCode = code;
  });

  // Await for promisified command to complete
  let { stdout, stderr } = await promise;
  stdout = stdout.trim();
  stderr = stderr.trim();

  if (exitCode || stderr) {
    status = "FAIL";
    description = `Error during execution.`;
  } else {
    status = "PASS";
    description = `Executed command.`;
  }
  result = { status, description, stdout, stderr, exitCode };
  return { result };
}

async function wait(action, page) {
  let status;
  let description;
  let result;

  if (action.duration === "") {
    duration = 10000;
  } else {
    duration = action.duration;
  }

  if (action.css) {
    try {
      await page.mainFrame().waitForSelector(action.css, { timeout: duration });
    } catch {
      status = "FAIL";
      description = `Couldn't find an element matching 'css' within the duration.`;
      result = { status, description };
      return { result };
    }
  } else {
    await new Promise((r) => setTimeout(r, duration));
  }

  // PASS
  status = "PASS";
  description = `Wait complete.`;
  result = { status, description };
  return { result };
}

// Click an element.  Assumes findElement() only found one matching element.
async function typeElement(action, elementHandle) {
  let status;
  let description;
  let result;
  let keys;
  if (!action.keys && !action.trailingSpecialKey) {
    // Fail: No keys specified
    status = "FAIL";
    description = `Specified values for 'keys and/ot 'trailingSpecialKey'."`;
    result = { status, description };
    return { result };
  }
  // Load environment variables
  if (action.env) {
    result = await setEnvs(action.env);
    if (result.status === "FAIL") return { result };
  }
  // Type keys
  if (action.keys) {
    // Resolve environment variables in keys
    keys = loadEnvs(action.keys);

    try {
      await elementHandle.type(keys);
    } catch {
      // FAIL
      status = "FAIL";
      description = `Couldn't type keys.`;
      result = { status, description };
      return { result };
    }
  }
  // Type training special key
  if (action.trailingSpecialKey) {
    try {
      await elementHandle.press(action.trailingSpecialKey);
    } catch {
      // FAIL: Text didn't match
      status = "FAIL";
      description = `Couldn't type special key.`;
      result = { status, description };
      return { result };
    }
  }
  // PASS
  status = "PASS";
  description = `Typed keys.`;
  result = { status, description };
  return { result };
}

// Identify if text in element matches expected text. Assumes findElement() only found one matching element.
async function matchText(action, page) {
  let status;
  let description;
  let result;
  let elementText;
  let text;

  // Load environment variables
  if (action.env) {
    let result = await setEnvs(action.env);
    if (result.status === "FAIL") return { result };
  }
  // Set text
  text = loadEnvs(action.text);

  let elementTag = await page.$eval(action.css, (element) =>
    element.tagName.toLowerCase()
  );
  if (elementTag === "button" || elementTag === "input") {
    // Displayed text is defined by 'value' for button and input elements.
    elementText = await page.$eval(action.css, (element) => element.value);
  } else {
    // Displayed text defined by 'textContent' for all other elements.
    elementText = await page.$eval(
      action.css,
      (element) => element.textContent
    );
  }
  if (elementText.trim() === text) {
    // PASS
    status = "PASS";
    description = "Element text matched expected text.";
    result = { status, description };
    return { result };
  } else {
    // FAIL: Text didn't match
    status = "FAIL";
    description = `Element text didn't match expected text. Element text: ${elementText}`;
    result = { status, description };
    return { result };
  }
}

// Find a single element
async function findElement(action, page) {
  if (!action.css) {
    // FAIL: No CSS
    let status = "FAIL";
    let description = "'css' is a required field.";
    let result = { status, description };
    return { result };
  }
  let elements = await page.$$eval(action.css, (elements) =>
    elements.map((element) => element.outerHTML)
  );
  if (elements.length === 0) {
    // FAIL: No CSS
    let status = "FAIL";
    let description = " No elements matched CSS selectors.";
    let result = { status, description };
    return { result };
  } else if (elements.length > 1) {
    // FAIL: No CSS
    let status = "FAIL";
    let description = "More than one element matched CSS selectors.";
    let result = { status, description };
    return { result };
  } else {
    // PASS
    let elementHandle = await page.$(action.css);
    let status = "PASS";
    let description = "Found one element matching CSS selectors.";
    let result = { status, description };
    return { result, elementHandle };
  }
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
    await new Promise(resolve => setTimeout(resolve, 1000))
    try {
      let resp = await axios.get("http://localhost:4723/sessions");
      if (resp.status === 200) isReady = true;
    } catch { }
  }
  return isReady;
}

// Start the Appium driver specified in `capabilities`.
async function driverStart(capabilities) {
  const driver = await wdio.remote({
    protocol: "http",
    hostname: "localhost",
    port: 4723,
    path: "/",
    capabilities
  });
  return driver;
}