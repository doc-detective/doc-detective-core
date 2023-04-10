const { exit } = require("yargs");

main();

async function main() {
  const { BROWSERS } = await import("@eyeo/get-browser-binary");
  // Install Chromium
  // console.log("Installing Chromium");
  // let chromium = await BROWSERS.chromium.installBrowser("latest");
  // Install Firefox
  console.log("Installing Firefox");
  let firefox = await BROWSERS.firefox.installBrowser("latest");
  // TODO: Installing Edge requires superuser privileges on Linux
  // console.log("Installing Edge");
  // let edge = await BROWSERS.edge.installBrowser("latest");
  // TODO: Catch misc install errors
}
