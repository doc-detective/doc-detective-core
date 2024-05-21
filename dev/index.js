// const axios = require("axios");
// const { exit } = require("node:process");
// const wdio = require("webdriverio");
// const { spawnCommand } = require("./src/utils");
const { runTests, runCoverage, buildTests } = require("../src");
const { validate, schemas } = require("doc-detective-common");
const { execCommand, spawnCommand } = require("../src/utils");
const path = require("path");
const { Confirm, Form, Toggle } = require("enquirer");

main();

async function main() {
  json = {
    input: "./dev/doc-content.md",
    logLevel: "debug",
    fileTypes: [
      {
        name: "Markdown",
        extensions: [".md"],
        testStartStatementOpen: "[comment]: # (test start",
        testStartStatementClose: ")",
        testIgnoreStatement: "[comment]: # (test ignore)",
        testEndStatement: "[comment]: # (test end)",
        stepStatementOpen: "[comment]: # (step",
        stepStatementClose: ")",
        markup: [],
      },
    ],
  };
  // console.log(json);
  result = await buildTests(json);
  console.log(JSON.stringify(result, null, 2));
}
