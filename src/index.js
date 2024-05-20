const { setConfig } = require("./config");
const { setFiles, parseTests, log, cleanTemp } = require("./utils");
const { runSpecs } = require("./tests");
const { checkTestCoverage, checkMarkupCoverage } = require("./analysis");
const { telemetryNotice, sendTelemetry } = require("./telem");
const { buildSpecs } = require("./build");

exports.runTests = runTests;
exports.runCoverage = runCoverage;
exports.buildTests = buildTests;

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

  // Telemetry notice
  telemetryNotice(config);

  // Set files
  const files = await setFiles(config);
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

  // Clean up
  cleanTemp();

  // Send telemetry
  sendTelemetry(config, "runTests", results);
  log(config, "info", supportMessage);

  return results;
}

async function buildTests(config) {
  // Set config
  config = await setConfig(config);
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

  // Telemetry notice
  telemetryNotice(config);

  // Set files
  const files = await setFiles(config);
  log(config, "debug", `FILES:`);
  log(config, "debug", files);

  // Build test specs
  const specs = await buildSpecs(config, files);
  log(config, "debug", `SPECS:`);
  log(config, "debug", specs);

  // Clean up
  cleanTemp();

  // // Send telemetry
  // sendTelemetry(config, "buildTests", specs);

  return specs;
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
  const files = await setFiles(config);
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
