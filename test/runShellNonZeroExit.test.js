const { runTests } = require("../src");
const assert = require("assert").strict;
const path = require("path");
const artifactPath = path.resolve("./test/artifacts");
const config_base = require(`${artifactPath}/config.json`);
const inputPath = `${artifactPath}/runShellNonZeroExit.json`;
const fs = require("fs");

before(function() {
  const spec = {
    tests: [
      {
        description: "Run shell command with non-zero exit code",
        steps: [
          {
            action: "runShell",
            command: "exit 1",
            exitCodes: [1,-2],
          },
        ],
      },
    ]
  }
  // Write spec to file
  fs.writeFileSync(`${artifactPath}/runShellNonZeroExit.json`, JSON.stringify(spec));
});

after(function() {
  // Remove spec file
  fs.unlinkSync(`${artifactPath}/runShellNonZeroExit.json`);
});

describe("Run tests successfully", function() {
  // Set indefinite timeout
  this.timeout(0);
  it("All specs pass", async () => {
    const config_tests = JSON.parse(JSON.stringify(config_base));
    config_tests.runTests.input = inputPath;
    const result = await runTests(config_tests);
    assert.equal(result.summary.specs.fail, 0);
  });
});