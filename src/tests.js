const appium = require("appium");
const wdio = require("webdriverio");
const { exit } = require("process");
const { setEnvs, log, timestamp, loadEnvs } = require("./utils");
const axios = require("axios");
const arch = require("arch");
require("geckodriver");
const { goTo } = require("./tests/goTo");
const { runShell } = require("./tests/runShell");
// const { clickElement } = require("./tests/click");
// const { moveMouse } = require("./tests/moveMouse");
// const { scroll } = require("./tests/scroll");
// const { screenshot } = require("./tests/screenshot");
// const { startRecording, stopRecording } = require("./tests/record");
// const { httpRequest } = require("./tests/httpRequest");

exports.runSpecs = runSpecs;
// exports.appiumStart = appiumStart;
// exports.appiumIsReady = appiumIsReady;
// exports.driverStart = driverStart;

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
            id: "dev-step",
            description: "",
            action: "goTo",
            uri: "www.google.com",
          },
          {
            action: "moveMouse",
            css: "#gbqfbb",
            alignH: "center",
            alignV: "center",
          },
          {
            action: "moveMouse",
            css: "[title=Search]",
            alignV: "center",
          },
          {
            action: "type",
            css: "[title=Search]",
            keys: "kittens",
            trailingSpecialKey: "Enter",
          },
          {
            action: "scroll",
            y: 300,
          },
          {
            action: "screenshot",
            filename: "results.png",
            matchPrevious: true,
            matchThreshold: 0.1,
          },
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
  switch (step.action) {
    case "goTo":
      actionResult = await goTo(config, step, driver);
      break;
    // case "find":
    //   // Perform sub-action: wait
    //   if (typeof action.wait === "undefined") action.wait = {};
    //   action.wait.css = action.css;
    //   waitResult = await wait(action.wait, page);
    //   delete action.wait.css;
    //   if (waitResult.result.status === "FAIL") {
    //     return waitResult;
    //   }
    //   // Perform find
    //   result = await findElement(action, page);
    //   if (result.result.status === "FAIL") return result;
    //   // Perform sub-action: matchText
    //   if (action.matchText) {
    //     action.matchText.css = action.css;
    //     matchResult = await matchText(action.matchText, page);
    //     delete action.matchText.css;
    //     result.result.description =
    //       result.result.description + " " + matchResult.result.description;
    //     if (matchResult.result.status === "FAIL") {
    //       result.result.status = "FAIL";
    //       return result;
    //     }
    //   }
    //   // Perform sub-action: moveMouse
    //   if (action.moveMouse) {
    //     action.moveMouse.css = action.css;
    //     move = await moveMouse(
    //       action.moveMouse,
    //       page,
    //       result.elementHandle,
    //       config
    //     );
    //     delete action.moveMouse.css;
    //     result.result.description =
    //       result.result.description + " " + move.result.description;
    //     if (move.result.status === "FAIL") {
    //       result.result.status = "FAIL";
    //       return result;
    //     }
    //   }
    //   // Perform sub-action: click
    //   if (action.click) {
    //     action.click.css = action.css;
    //     click = await clickElement(action.click, result.elementHandle);
    //     delete action.click.css;
    //     result.result.description =
    //       result.result.description + " " + click.result.description;
    //     if (click.result.status === "FAIL") {
    //       result.result.status = "FAIL";
    //       return result;
    //     }
    //   }
    //   // Perform sub-action: type
    //   if (action.type) {
    //     action.type.css = action.css;
    //     type = await typeElement(action.type, result.elementHandle);
    //     delete action.type.css;
    //     result.result.description =
    //       result.result.description + " " + type.result.description;
    //     if (type.result.status === "FAIL") {
    //       result.result.status = "FAIL";
    //     }
    //   }
    //   break;
    // case "matchText":
    //   find = await findElement(action, page);
    //   if (find.result.status === "FAIL") return find;
    //   result = await matchText(action, page);
    //   break;
    // case "click":
    //   find = await findElement(action, page);
    //   if (find.result.status === "FAIL") return find;
    //   result = await clickElement(action, find.elementHandle);
    //   break;
    // case "type":
    //   find = await findElement(action, page);
    //   if (find.result.status === "FAIL") return find;
    //   result = await typeElement(action, find.elementHandle);
    //   break;
    // case "moveMouse":
    //   find = await findElement(action, page);
    //   if (find.result.status === "FAIL") return find;
    //   result = await moveMouse(action, page, find.elementHandle, config);
    //   break;
    // case "scroll":
    //   result = await scroll(action, page, config);
    //   break;
    // case "wait":
    //   result = await wait(action, page);
    //   break;
    // case "screenshot":
    //   result = await screenshot(action, page, config);
    //   break;
    // case "startRecording":
    //   result = await startRecording(action, page, config);
    //   break;
    // case "stopRecording":
    //   result = await stopRecording(videoDetails, config);
    //   break;
    case "runShell":
      actionResult = await runShell(config, step);
      break;
    // case "checkLink":
    //   result = await checkLink(action);
    //   break;
    // case "httpRequest":
    //   result = await httpRequest(action, config);
    //   break;
  }
  return actionResult;
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
