const kill = require("tree-kill");
const wdio = require("webdriverio");
const { log } = require("./utils");
const { loadEnvs } = require("./utils/loadEnvs");
const axios = require("axios");
const { instantiateCursor } = require("./tests/moveTo");
const { goTo } = require("./tests/goTo");
const { findElement } = require("./tests/findElement");
const { runShell } = require("./tests/runShell");
const { checkLink } = require("./tests/checkLink");
const { typeKeys } = require("./tests/typeKeys");
const { wait } = require("./tests/wait");
const { saveScreenshot } = require("./tests/saveScreenshot");
const { startRecording } = require("./tests/startRecording");
const { stopRecording } = require("./tests/stopRecording");
const { setVariables } = require("./tests/setVariables");
const { httpRequest } = require("./tests/httpRequest");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const uuid = require("uuid");
const { setAppiumHome } = require("./appium");
const { loadDescription } = require("./openapi");

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

// Get Appium driver capabilities and apply options.
function getDriverCapabilities(config, name, options) {
  let capabilities = {};
  let args = [];

  // Set Firefox capabilities
  switch (name) {
    case "firefox":
      firefox = config.environment.apps.find((app) => app.name === "firefox");
      if (!firefox) break;
      // Set args
      // Reference: https://wiki.mozilla.org/Firefox/CommandLineOptions
      if (options.headless) args.push("--headless");
      // Set capabilities
      capabilities = {
        platformName: config.environment.platform,
        "appium:automationName": "Gecko",
        browserName: "MozillaFirefox",
        "moz:firefoxOptions": {
          // Reference: https://developer.mozilla.org/en-US/docs/Web/WebDriver/Capabilities/firefoxOptions
          args,
          // If recording, make bottom corners pointed
          profile:
            "UEsDBBQAAAAIAKm6lldWzDiRbgAAAKUAAAAlAAAAZmlyZWZveF9wcm9maWxlL2Nocm9tZS91c2VyQ2hyb21lLmNzc3XMQQrCMBBG4X1O8Yu7QqhrPYOHiGbaDpqZMBmJIN7dgu6K28fHC+OAc7oRLuquBVc1IWvQCb6s1bQ3MnSWrB1VWZwyhjHsS2KJv/4KWAeWyeL3E+80ebSU+dGOONQndlyqmifx0wYbz8t//Q4fUEsBAhQDFAAAAAgAqbqWV1bMOJFuAAAApQAAACUAAAAAAAAAAAAAAKSBAAAAAGZpcmVmb3hfcHJvZmlsZS9jaHJvbWUvdXNlckNocm9tZS5jc3NQSwUGAAAAAAEAAQBTAAAAsQAAAAAA",
          prefs: {
            "toolkit.legacyUserProfileCustomizations.stylesheets": true, // Enable userChrome.css and userContent.css
          },
          binary: options.path || firefox.path,
        },
      };
      break;
    case "safari":
      // Set Safari capabilities
      if (config.environment.apps.find((app) => app.name === "safari")) {
        safari = config.environment.apps.find((app) => app.name === "safari");
        if (!safari) break;
        // Set capabilities
        capabilities = {
          platformName: "Mac",
          "appium:automationName": "Safari",
          browserName: "Safari",
        };
      }
      break;
    case "chrome":
    case "edge":
      // Set Chrome(ium) capabilities
      if (config.environment.apps.find((app) => app.name === name)) {
        const chromium = config.environment.apps.find(
          (app) => app.name === name
        );
        if (!chromium) break;

        browserName = name === "edge" ? "MicrosoftEdge" : "chrome";
        // Set args
        args.push(`--enable-chrome-browser-cloud-management`);
        args.push(`--auto-select-desktop-capture-source=RECORD_ME`);
        // if (name === "edge") args.push("--disable-features=msEdgeIdentityFeatures");
        if (options.headless) args.push("--headless", "--disable-gpu");
        if (process.env.CONTAINER) args.push("--no-sandbox");
        // Set capabilities
        capabilities = {
          platformName: config.environment.platform,
          "appium:automationName": "Chromium",
          "appium:executable": options.driverPath || chromium.driver,
          browserName,
          "goog:chromeOptions": {
            // Reference: https://chromedriver.chromium.org/capabilities#h.p_ID_102
            args,
            prefs: {
              "download.default_directory": config.runTests.downloadDirectory,
              "download.prompt_for_download": false,
              "download.directory_upgrade": true,
            },
            binary: options.path || chromium.path,
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

function isDriverRequired(appiumRequired, test) {
  let driverRequired = false;
  if (appiumRequired) {
    if (test.contexts && test.contexts.length > 0) driverRequired = true;
    test.steps.forEach((step) => {
      // Check if test includes actions that require a driver.
      if (driverActions.includes(step.action)) driverRequired = true;
    });
  }
  return driverRequired;
}

// Check if context is supported by current platform and available apps
function isSupportedContext(context, apps, platform) {
  // Check apps
  let isSupportedApp = true;
  if (context.app.name)
    isSupportedApp = apps.find((app) => app.name === context.app.name);
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
  // Select the first available app
  if (contexts.length === 0) {
    const fallback = ["chrome", "firefox", "safari", "edge"];
    for (const browser of fallback) {
      if (contexts.length != 0) continue;
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

  // Warm up Appium
  if (appiumRequired) {
    // Set Appium home directory
    setAppiumHome();
    // Start Appium server
    appium = spawn("npx", ["appium"], {
      shell: true,
      windowsHide: true,
      cwd: path.join(__dirname, ".."),
    });
    appium.stdout.on("data", (data) => {
      //   console.log(`stdout: ${data}`);
    });
    appium.stderr.on("data", (data) => {
      //   console.error(`stderr: ${data}`);
    });
    await appiumIsReady();
    log(config, "debug", "Appium is ready.");
  }

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

    // Capture all OpenAPI definitions
    const openApiDefinitions = [];
    if (config?.integrations?.openApi?.length > 0)
      openApiDefinitions.push(...config.integrations.openApi);
    if (spec?.openApi?.length > 0) {
      for (const definition of spec.openApi) {
        try {
          const openApiDefinition = await loadDescription(
            definition.descriptionPath
          );
          definition.definition = openApiDefinition;
        } catch (error) {
          log(
            config,
            "error",
            `Failed to load OpenAPI definition from ${definition.descriptionPath}: ${error.message}`
          );
          continue; // Skip this definition
        }
        const existingDefinitionIndex = openApiDefinitions.findIndex(
          (def) => def.name === definition.name
        );
        if (existingDefinitionIndex > -1) {
          openApiDefinitions.splice(existingDefinitionIndex, 1);
        }
        openApiDefinitions.push(definition);
      }
    }

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

      // Capture test-level OpenAPI definitions
      if (test?.openApi?.length > 0) {
        for (const definition of test.openApi) {
          try {
            const openApiDefinition = await loadDescription(
              definition.descriptionPath
            );
            definition.definition = openApiDefinition;
          } catch (error) {
            log(
              config,
              "error",
              `Failed to load OpenAPI definition from ${definition.descriptionPath}: ${error.message}`
            );
            continue; // Skip this definition
          }
          const existingDefinitionIndex = openApiDefinitions.findIndex(
            (def) => def.name === definition.name
          );
          if (existingDefinitionIndex > -1) {
            openApiDefinitions.splice(existingDefinitionIndex, 1);
          }
          openApiDefinitions.push(definition);
        }
      }

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

        let driver;
        const driverRequired = isDriverRequired(appiumRequired, test);
        if (driverRequired) {
          // Define driver capabilities
          // TODO: Support custom apps
          let caps = getDriverCapabilities(config, context.app.name, {
            path: context.app?.path,
            width: context.app?.options?.width || 1200,
            height: context.app?.options?.height || 800,
            headless: context.app?.options?.headless !== false,
          });
          log(config, "debug", "CAPABILITIES:");
          log(config, "debug", caps);

          // Instantiate driver
          try {
            driver = await driverStart(caps);
          } catch (error) {
            try {
              // If driver fails to start, try again as headless
              log(
                config,
                "warning",
                `Failed to start context '${context.app?.name}' on '${platform}'. Retrying as headless.`
              );
              if (typeof context.app.options === "undefined")
                context.app.options = {};
              context.app.options.headless = true;
              caps = getDriverCapabilities(config, context.app.name, {
                path: context.app?.path,
                width: context.app?.options?.width || 1200,
                height: context.app?.options?.height || 800,
                headless: context.app?.options?.headless !== false,
              });
              driver = await driverStart(caps);
            } catch (error) {
              let errorMessage = `Failed to start context '${context.app?.name}' on '${platform}'.`;
              if (context.app?.name === "safari")
                errorMessage =
                  errorMessage +
                  " Make sure you've run `safaridriver --enable` in a terminal and enabled 'Allow Remote Automation' in Safari's Develop menu.";
              log(config, "error", errorMessage);
              contextReport = {
                result: { status: "SKIPPED", description: errorMessage },
                ...contextReport,
              };
              report.summary.contexts.skipped++;
              testReport.contexts.push(contextReport);
              continue;
            }
          }

          if (context.app?.options?.width || context.app?.options?.height) {
            // Get driver window size
            const windowSize = await driver.getWindowSize();
            // Resize window if necessary
            await driver.setWindowSize(
              context.app?.options?.width || windowSize.width,
              context.app?.options?.height || windowSize.height
            );
          }
        }

        // Iterates steps
        for (let step of test.steps) {
          // Set step id if not defined
          if (!step.id) step.id = `${uuid.v4()}`;
          log(config, "debug", `STEP:\n${JSON.stringify(step, null, 2)}`);

          const stepResult = await runStep(config, context, step, driver, {
            openApiDefinitions,
          });
          log(
            config,
            "debug",
            `RESULT: ${stepResult.status}, ${stepResult.description}`
          );

          stepResult.result = stepResult.status;
          stepResult.resultDescription = stepResult.description;
          delete stepResult.status;
          delete stepResult.description;

          // Add step result to report
          const stepReport = {
            ...stepResult,
            ...step,
          };
          contextReport.steps.push(stepReport);
          report.summary.steps[stepReport.result.toLowerCase()]++;
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

        if (driverRequired) {
          // Close driver
          try {
            await driver.deleteSession();
          } catch (error) {
            log(
              config,
              "error",
              `Failed to delete driver session: ${error.message}`
            );
          }
        }
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
async function runStep(config, context, step, driver, options = {}) {
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
    case "startRecording":
      actionResult = await startRecording(config, context, step, driver);
      config.recording = actionResult.recording;
      break;
    case "stopRecording":
      actionResult = await stopRecording(config, step, driver);
      delete config.recording;
      break;
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
      actionResult = await httpRequest(
        config,
        step,
        options?.openApiDefinitions
      );
      break;
    default:
      actionResult = { status: "FAIL", description: "Unsupported action." };
      break;
  }
  // If recording, wait until browser is loaded, then instantiate cursor
  if (config.recording) {
    const currentUrl = await driver.getUrl();
    if (currentUrl !== driver.state.url) {
      driver.state.url = currentUrl;
      await instantiateCursor(driver);
    }
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
  driver.state = { url: "", x: null, y: null };
  return driver;
}
