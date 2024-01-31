const path = require("path");
const { spawnCommand } = require("../src/utils");
const browsers = require("@puppeteer/browsers");
const geckodriver = require("geckodriver");
const edgedriver = require("edgedriver");

async function main() {
  await installBrowsers();
  await installAppiumDepencencies();
}

main();

async function installBrowsers() {
  // Move to doc-detective-core directory to correctly set browser snapshot directory
  cwd = process.cwd();
  process.chdir(path.join(__dirname, ".."));

  // Meta
  const browser_platform = browsers.detectBrowserPlatform();
  const cacheDir = path.resolve("browser-snapshots");

  console.log("Installing Chrome browser");
  let browser = "chrome";
  buildId = await browsers.resolveBuildId(browser, browser_platform, "stable");
  const chromeInstall = await browsers.install({
    browser,
    buildId,
    cacheDir,
  });
  console.log("Installing Firefox browser");
  browser = "firefox";
  buildId = await browsers.resolveBuildId(browser, browser_platform, "latest");
  const firefoxInstall = await browsers.install({
    browser,
    buildId,
    cacheDir,
  });
  // Install ChromeDriver
  console.log("Installing ChromeDriver binary");
  browser = "chromedriver";
  buildId = await browsers.resolveBuildId(browser, browser_platform, "stable");
  const chromeDriverInstall = await browsers.install({
    browser,
    buildId,
    cacheDir,
  });
  // Install EdgeDriver
  console.log("Installing EdgeDriver binary");
  const edgeDriverPath = await edgedriver.download();
  // Install Geckodriver
  console.log("Installing Geckodriver binary");
  if (__dirname.includes("node_modules")) {
    // If running from node_modules
    binPath = path.join(__dirname, "../../.bin");
  } else {
    binPath = path.join(__dirname, "../node_modules/.bin");
  }
  process.env.GECKODRIVER_CACHE_DIR = binPath;
  const geckoInstall = await geckodriver.download();

  // Move back to original directory
  process.chdir(cwd);
}

// Run `appium` to install the Gecko driver, Chromium driver, and image plugin.
async function installAppiumDepencencies() {
  if (__dirname.includes("node_modules")) {
    // If running from node_modules
    appiumPath = path.join(__dirname, "../../appium");
  } else {
    appiumPath = path.join(__dirname, "../node_modules/appium");
  }
  // Install appium dependencies
  console.log("Installing Chrome/Edge driver");
  chromiumInstall = await spawnCommand(
    `node ${appiumPath} driver install chromium`
  );
  console.log("Installing Firefox driver");
  geckoInstall = await spawnCommand(`node ${appiumPath} driver install gecko`);
  // macOS-only
  if (process.platform == "darwin") {
    console.log("Installing Safari driver");
    safariInstall = await spawnCommand(
      `node ${appiumPath} driver install safari`
    );
  }
}
