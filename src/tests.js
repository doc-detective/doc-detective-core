const kill = require("tree-kill");
const wdio = require("webdriverio");
const os = require("os");
const { log, replaceEnvs } = require("./utils");
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
const { loadVariables } = require("./tests/loadVariables");
const { httpRequest } = require("./tests/httpRequest");
const { clickElement } = require("./tests/click");
const { runCode } = require("./tests/runCode");
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
  "click",
  "stopRecord",
  "find",
  "goTo",
  "record",
  "screenshot",
  "type",
];

// Get Appium driver capabilities and apply options.
function getDriverCapabilities({ config, name, options }) {
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
        "wdio:enforceWebDriverClassic": true,
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
          binary: firefox.path,
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
          "wdio:enforceWebDriverClassic": true,
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
        args.push(`--no-sandbox`);
        // if (name === "edge") args.push("--disable-features=msEdgeIdentityFeatures");
        if (options.headless) args.push("--headless", "--disable-gpu");
        if (process.platform === "linux") args.push("--no-sandbox");
        // Set capabilities
        capabilities = {
          platformName: config.environment.platform,
          "appium:automationName": "Chromium",
          "appium:executable": chromium.driver,
          browserName,
          "wdio:enforceWebDriverClassic": true,
          "goog:chromeOptions": {
            // Reference: https://chromedriver.chromium.org/capabilities#h.p_ID_102
            args,
            prefs: {
              "download.default_directory": os.tmpdir(),
              "download.prompt_for_download": false,
              "download.directory_upgrade": true,
            },
            binary: chromium.path,
          },
        };
      }
      break;
    default:
      break;
  }

  return capabilities;
}

// Check if any steps require an Appium driver.
function isAppiumRequired(specs) {
  let appiumRequired = false;
  specs.forEach((spec) => {
    spec.tests.forEach((test) => {
      test.steps.forEach((step) => {
        // Check if test includes actions that require a driver.
        if (isDriverRequired({ test })) {
          appiumRequired = true;
        }
      });
    });
  });
  return appiumRequired;
}

function isDriverRequired({ test }) {
  let driverRequired = false;
  test.steps.forEach((step) => {
    // Check if test includes actions that require a driver.
    driverActions.forEach((action) => {
      if (typeof step[action] !== "undefined") driverRequired = true;
    });
  });
  return driverRequired;
}

// Check if context is supported by current platform and available apps
function isSupportedContext({ context, apps, platform }) {
  // Check browsers
  let isSupportedApp = true;
  // Check platform
  const isSupportedPlatform = context.platform === platform;
  if (context?.browser?.name)
    isSupportedApp = apps.find((app) => app.name === context.browser.name);
  // Return boolean
  if (isSupportedApp && isSupportedPlatform) {
    return true;
  } else {
    return false;
  }
}

function resolveContexts({ contexts, test }) {
  const resolvedContexts = [];

  // Check if current test requires a browser
  let browserRequired = false;
  test.steps.forEach((step) => {
    // Check if test includes actions that require a driver.
    driverActions.forEach((action) => {
      if (typeof step[action] !== "undefined") browserRequired = true;
    });
  });

  // Standardize context format
  contexts.forEach((context) => {
    if (context.browsers) {
      if (
        typeof context.browsers === "string" ||
        (typeof context.browsers === "object" &&
          !Array.isArray(context.browsers))
      ) {
        // If browsers is a string or an object, convert to array
        context.browsers = [context.browsers];
      }
      context.browsers = context.browsers.map((browser) => {
        if (typeof browser === "string") {
          browser = { name: browser };
        }
        if (browser.name === "safari") browser.name = "webkit";
        return browser;
      });
    }
    if (context.platforms) {
      if (typeof context.platforms === "string") {
        context.platforms = [context.platforms];
      }
    }
  });

  // Resolve to final contexts. Each context should include a single platform and at most a single browser.
  // If no browsers are required, filter down to platform-based contexts
  // If browsers are required, create contexts for each specified combination of platform and browser

  contexts.forEach((context) => {
    const staticContexts = [];
    context.platforms.forEach((platform) => {
      const staticContext = { platform };
      if (!browserRequired) {
        staticContexts.push(staticContext);
      } else {
        context.browsers.forEach((browser) => {
          staticContext.browser = browser;
          staticContexts.push(staticContext);
        });
      }
    });
    // For each static context, check if a matching object already exists in resolvedContexts. If not, push to resolvedContexts.
    staticContexts.forEach((staticContext) => {
      const existingContext = resolvedContexts.find((resolvedContext) => {
        return (
          resolvedContext.platform === staticContext.platform &&
          JSON.stringify(resolvedContext.browser) ===
            JSON.stringify(staticContext.browser)
        );
      });
      if (!existingContext) {
        resolvedContexts.push(staticContext);
      }
    });
  });

  return resolvedContexts;
}

// Define default contexts based on config.runOn, then using a fallback strategy of Chrome(ium) and Firefox.
// TODO: Update with additional browsers as they are supported.
function getDefaultContexts(config) {
  const contexts = [];
  const apps = config.environment.apps;
  const platform = config.environment.platform;
  // Check if contexts are defined in config
  if (config.runOn) {
    // Check if contexts are supported
    config.runOn.forEach((context) => {
      if (isSupportedContext(context, apps, platform)) {
        contexts.push(context);
      }
    });
  }
  // If no contexts are defined in config, or if none are supported, use fallback strategy
  // Select the first available app
  if (contexts.length === 0) {
    const fallback = ["firefox", "chrome", "safari"];
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

// Set window size to match target viewport size
async function setViewportSize(context, driver) {
  if (context.browser?.viewport?.width || context.browser?.viewport?.height) {
    // Get viewport size, not window size
    const viewportSize = await driver.executeScript(
      "return { width: window.innerWidth, height: window.innerHeight }",
      []
    );
    // Get window size
    const windowSize = await driver.getWindowSize();
    // Get viewport size delta
    const deltaWidth =
      (context.browser?.viewport?.width || viewportSize.width) -
      viewportSize.width;
    const deltaHeight =
      (context.browser?.viewport?.height || viewportSize.height) -
      viewportSize.height;
    // Resize window if necessary
    await driver.setWindowSize(
      windowSize.width + deltaWidth,
      windowSize.height + deltaHeight
    );
    // Confirm viewport size
    const finalViewportSize = await driver.executeScript(
      "return { width: window.innerWidth, height: window.innerHeight }",
      []
    );
  }
}

// Iterate through and execute test specifications and contained tests.
async function runSpecs(config, specs) {
  // Set initial shorthand values
  const configContexts = config.runOn || [];
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
    log(config, "debug", `SPEC: ${spec.specId}`);

    let specReport = { tests: [] };

    // Conditionally override contexts
    const specContexts = spec.runOn || configContexts;

    // Capture all OpenAPI definitions
    // TODO: Refactor into standalone function
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
      log(config, "debug", `TEST: ${test.testId}`);

      let testReport = { contexts: [] };

      // Resolve contexts
      const testContexts = resolveContexts({
        test,
        contexts: test.runOn || specContexts,
      });

      // Capture test-level OpenAPI definitions
      // TODO: Refactor into standalone function
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
        log(config, "debug", `CONTEXT:\n${JSON.stringify(context, null, 2)}`);

        let contextReport = {
          steps: [],
        };

        // Check if current environment supports given contexts
        const supportedContext = isSupportedContext({
          context: context,
          apps: availableApps,
          platform: platform,
        });

        // If context isn't supported, skip it
        if (!supportedContext) {
          log(
            config,
            "warning",
            `Skipping context. The current system doesn't support this context (${JSON.stringify(
              context
            )}).`
          );
          contextReport = { result: { status: "SKIPPED" }, ...contextReport };
          report.summary.contexts.skipped++;
          testReport.contexts.push(contextReport);
          continue;
        }

        let driver;
        const driverRequired = isDriverRequired({ test: test });
        if (driverRequired) {
          // Define driver capabilities
          // TODO: Support custom apps
          let caps = getDriverCapabilities({
            config: config,
            name: context.browser.name,
            options: {
              width: context.browser?.window?.width || 1200,
              height: context.browser?.window?.height || 800,
              headless: context.browser?.headless !== false,
            },
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
                `Failed to start context '${context.browser?.name}' on '${platform}'. Retrying as headless.`
              );
              context.browser.headless = true;
              caps = getDriverCapabilities({
                config: config,
                name: context.browser.name,
                options: {
                  width: context.browser?.window?.width || 1200,
                  height: context.browser?.window?.height || 800,
                  headless: context.browser?.headless !== false,
                },
              });
              driver = await driverStart(caps);
            } catch (error) {
              let errorMessage = `Failed to start context '${context.browser?.name}' on '${platform}'.`;
              if (context.browser?.name === "safari")
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

          if (
            context.browser?.viewport?.width ||
            context.browser?.viewport?.height
          ) {
            // Set driver viewport size
            await setViewportSize(context, driver);
          } else if (
            context.browser?.window?.width ||
            context.browser?.window?.height
          ) {
            // Get driver window size
            const windowSize = await driver.getWindowSize();
            // Resize window if necessary
            await driver.setWindowSize(
              context.browser?.window?.width || windowSize.width,
              context.browser?.window?.height || windowSize.height
            );
          }
        }

        // Iterates steps
        for (let step of test.steps) {
          // Set step id if not defined
          if (!step.stepId) step.stepId = `${uuid.v4()}`;
          log(config, "debug", `STEP:\n${JSON.stringify(step, null, 2)}`);

          const stepResult = await runStep({
            config: config,
            context: context,
            step: step,
            driver: driver,
            options: {
              openApiDefinitions,
            },
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

        // If recording, stop recording
        if (config.recording) {
          const stopRecordStep = {
            stopRecord: true,
            description: "Stopping recording",
            stepId: `${uuid.v4()}`,
          };
          const stepResult = await runStep({
            config: config,
            context: context,
            step: stopRecordStep,
            driver: driver,
            options: {
              openApiDefinitions,
            },
          });
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
async function runStep({ config, context, step, driver, options = {} }) {
  let actionResult;
  // Load values from environment variables
  step = replaceEnvs(step);
  if (typeof step.click !== "undefined") {
    actionResult = await clickElement({
      config: config,
      step: step,
      driver: driver,
    });
  } else if (typeof step.checkLink !== "undefined") {
    actionResult = await checkLink({ config: config, step: step });
  } else if (typeof step.find !== "undefined") {
    actionResult = await findElement({ config: config, step: step, driver });
  } else if (typeof step.stopRecord !== "undefined") {
    actionResult = await stopRecording({ config: config, step: step, driver });
  } else if (typeof step.goTo !== "undefined") {
    actionResult = await goTo({ config: config, step: step, driver: driver });
  } else if (typeof step.loadVariables !== "undefined") {
    actionResult = await loadVariables({ step: step });
  } else if (typeof step.httpRequest !== "undefined") {
    actionResult = await httpRequest({
      config: config,
      step: step,
      openApiDefinitions: options?.openApiDefinitions,
    });
  } else if (typeof step.record !== "undefined") {
    actionResult = await startRecording({
      config: config,
      context: context,
      step: step,
      driver: driver,
    });
    config.recording = actionResult.recording;
  } else if (typeof step.runCode !== "undefined") {
    actionResult = await runCode({ config: config, step: step });
  } else if (typeof step.runShell !== "undefined") {
    actionResult = await runShell({ config: config, step: step });
  } else if (typeof step.screenshot !== "undefined") {
    actionResult = await saveScreenshot({
      config: config,
      step: step,
      driver: driver,
    });
  } else if (typeof step.type !== "undefined") {
    actionResult = await typeKeys({
      config: config,
      step: step,
      driver: driver,
    });
  } else if (typeof step.wait !== "undefined") {
    actionResult = await wait({ step: step });
  } else {
    actionResult = {
      status: "FAIL",
      description: `Unknown step action: ${JSON.stringify(step)}`,
    };
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
