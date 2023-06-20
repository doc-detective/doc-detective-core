const { runTests, runCoverage } = require("../src");
const assert = require("assert").strict;
const path = require("path");
const artifactPath = path.resolve("./test/artifacts");
const config_base = require(`${artifactPath}/config.json`);
const inputPath = artifactPath;

describe("Analyze coverage sucessfully", function() {
  this.timeout(0);
  it("Summary values are as expected", async () => {
    const config_coverage = JSON.parse(JSON.stringify(config_base));
    config_coverage.runCoverage.input = inputPath;
    const result = await runCoverage(config_coverage);
    assert.equal(result.summary.covered, 6);
    assert.equal(result.summary.uncovered, 0);
    assert.equal(result.errors.length, 0);
  });
});

describe("Run tests sucessfully", function() {
  // Set indefinite timeout
  this.timeout(0);
  it("All specs pass", async () => {
    const config_tests = JSON.parse(JSON.stringify(config_base));
    config_tests.runTests.input = inputPath;
    const result = await runTests(config_tests);
    assert.equal(result.summary.specs.pass, 2);
  });
});