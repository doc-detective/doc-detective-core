const { setConfig } = require("./config");
const { qualityFiles, parseTests, log, cleanTemp } = require("./utils");
const { runSpecs } = require("./tests");
const { telemetryNotice, sendTelemetry } = require("./telem");

exports.runTests = runTests;

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
  config = await setConfig({config});
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

  // Telemetry notice
  telemetryNotice(config);

  // Set files
  const files = await qualityFiles({config});
  log(config, "debug", `FILES:`);
  log(config, "debug", files);

  // Set test specs
  const specs = await parseTests({config, files});
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
