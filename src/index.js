const { setConfig } = require("./config");
const { setFiles, parseTests, log } = require("./utils");
const { runSpecs } = require("./tests");
const { checkTestCoverage, checkMarkupCoverage } = require("./analysis");
const { getSuggestions } = require("./suggest");
const { telemetryNotice, sendTelemetry } = require("./telem");
const { installBrowsers, installAppiumDepencencies } = require("./deps");

exports.runTests = runTests;
exports.runCoverage = runCoverage;
exports.suggestTests = suggestTests;

const supportMessage = `
##########################################################################
# Thanks for using Doc Detective! If this project was helpful to you,    #
# please consider starring the repo on GitHub or sponsoring the project: #
# - GitHub Sponsors: https://github.com/sponsors/doc-detective           #
# - Open Collective: https://opencollective.com/doc-detective            #
##########################################################################`;

// Run tests defined in specifications and documentation source files.
async function runTests(config) {
  // Set config
  config = await setConfig(config);
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

  // Install dependencies
  await installDeps(config);

  // Telemetry notice
  telemetryNotice(config);

  // Set files
  const files = setFiles(config);
  log(config, "debug", `FILES:`);
  log(config, "debug", files);

  // Set test specs
  const specs = parseTests(config, files);
  log(config, "debug", `SPECS:`);
  log(config, "debug", specs);

  // Run test specs
  const results = await runSpecs(config, specs);
  log(config, "info", "RESULTS:");
  log(config, "info", results);
  log(config, "info", "Cleaning up and finishing post-processing.");

  // Send telemetry
  sendTelemetry(config, "runTests", results);
  log(config, "info", supportMessage);

  return results;
}

// Calculate test coverage of doc content.
async function runCoverage(config) {
  // Set config
  config = await setConfig(config);
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

  // Telemetry notice
  telemetryNotice(config);

  // Set files
  const files = setFiles(config);
  log(config, "debug", `FILES:`);
  log(config, "debug", files);

  const testCoverage = checkTestCoverage(config, files);
  log(config, "debug", "TEST COVERAGE:");
  log(config, "debug", testCoverage);

  const markupCoverage = checkMarkupCoverage(config, testCoverage);
  log(config, "debug", "MARKUP COVERAGE:");
  log(config, "debug", markupCoverage);

  // Send telemetry
  sendTelemetry(config, "runCoverage", markupCoverage);
  log(config, "info", supportMessage);

  return markupCoverage;
}

async function suggestTests(config) {

  const markupCoverage = await runCoverage(config);
  log(config, "debug", "MARKUP COVERAGE:");
  log(config, "debug", markupCoverage);

  const suggestionReport = getSuggestions(config, markupCoverage);
  log(config, "debug", "TEST SUGGESTIONS:");
  log(config, "debug", suggestionReport);

  return suggestionReport;
}

// Install internal dependencies
async function installDeps(config) {
  // Check if browsers are installed
  try {
    await installBrowsers(config);
  } catch (e) {
    console.log("Error installing browsers.");
  }

  // Check if Appium dependencies are installed
  try {
    await installAppiumDepencencies(config);
  } catch (e) {
    console.log("Error installing Appium dependencies.");
  }
}