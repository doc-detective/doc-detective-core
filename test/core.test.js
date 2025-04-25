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
  try {
    await server.start();
  } catch (error) {
    console.error(`Failed to start test server: ${error.message}`);
    throw error;
  }
});

// Stop the server after tests
after(async () => {
  try {
    await server.stop();
  } catch (error) {
    console.error(`Failed to stop test server: ${error.message}`);
    // Don't rethrow here to avoid masking test failures
  }
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