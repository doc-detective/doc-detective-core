const { runTests } = require("../src");
const { createServer } = require("./server");
const assert = require("assert").strict;
const path = require("path");
const artifactPath = path.resolve("./test/artifacts");
const config_base = require(`${artifactPath}/config.json`);
const inputPath = artifactPath;

// Create a server with custom options
const server = createServer({
  port: 8080,
  staticDir: './test/server/public',
  modifyResponse: (req, body) => {
    // Optional modification of responses
    return { ...body, extraField: 'added by server' };
  }
});

// Start the server before tests
before(async () => {
  await server.start();
});

// Stop the server after tests
after(async () => {
  await server.stop();
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