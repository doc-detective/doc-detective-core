const { setConfig } = require("./config");
const { setFiles, parseTests, outputResults, log } = require("./utils");
const { runSpecs } = require("./tests");
const { checkTestCoverage, checkMarkupCoverage } = require("./analysis");
const { reportCoverage } = require("./coverage");
const { suggestTests, runSuggestions } = require("./suggest");
const { exit } = require("process");
const { validate, schemas } = require("doc-detective-common");

exports.runTests = runTests;
exports.coverage = coverage;
exports.suggest = suggest;

json = schemas.config_v2.examples[3];
json.logLevel = "debug";
json.runTests.input = ".dev";
runTests(json);

// Run tests defined in specifications and documentation source files.
async function runTests(config) {
  // Set config
  config = await setConfig(config);
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

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

  return results;
}

async function coverage(config, argv) {
  // TODO
  console.log("Not yet supported in Doc Detective Core v2 beta.");
  exit(1);

  // Set args
  argv = setArgs(argv);
  log(config, "debug", `ARGV:`);
  log(config, "debug", argv);

  // Set config
  config = setConfig(config, argv);
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

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

  const coverageReport = reportCoverage(config, markupCoverage);
  log(config, "debug", "COVERAGE REPORT:");
  log(config, "debug", coverageReport);

  // Output
  outputResults(config.coverageOutput, coverageReport, config);

  return coverageReport;
}

async function suggest(config, argv) {
  // TODO
  console.log("Not yet supported in Doc Detective Core v2 beta.");
  exit(1);

  // Set args
  argv = setArgs(argv);
  log(config, "debug", `ARGV:`);
  log(config, "debug", argv);

  // Set config
  config = setConfig(config, argv);
  log(config, "debug", `CONFIG:`);
  log(config, "debug", config);

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

  const suggestionReport = suggestTests(config, markupCoverage);
  log(config, "debug", "TEST SUGGESTIONS:");
  log(config, "debug", suggestionReport);

  await runSuggestions(config, suggestionReport);

  // Output
  outputResults(config.testSuggestions.reportOutput, suggestionReport, config);

  return suggestionReport;
}
