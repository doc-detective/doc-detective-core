// const axios = require("axios");
// const { exit } = require("node:process");
// const wdio = require("webdriverio");
// const { spawnCommand } = require("./src/utils");
const { runTests, runCoverage, buildTests } = require("../src");
const { validate, schemas } = require("doc-detective-common");
const { execCommand, spawnCommand } = require("../src/utils");
const path = require("path");

main();
// const { spawn } = require("child_process");

//     // Start Appium server
//     if (__dirname.includes("node_modules")) {
//       // If running from node_modules
//       appiumPath = path.join(__dirname, "../../../appium");
//     } else {
//       // If running from source
//       appiumPath = path.join(__dirname, "../node_modules/appium");
//     }
//     console.log(appiumPath)
//     appium = spawn("node", [appiumPath]);
// // appium = spawn("appium");
// appium.stdout.on('data', (data) => {
//   console.log(`stdout: ${data}`);
// });

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
