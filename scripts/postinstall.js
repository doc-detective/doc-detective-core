const path = require("path");
const browsers = require("@puppeteer/browsers");
const geckodriver = require("geckodriver");
const edgedriver = require("edgedriver");

async function main() {
  await installBrowsers();
  // await installAppiumDepencencies();
}

main();

async function installBrowsers() {
  // Check if DOC_DETECTIVE_BROWSERS environment variable is set
  const specifiedBrowsers = process.env.DOC_DETECTIVE_BROWSERS
    ? process.env.DOC_DETECTIVE_BROWSERS.split(",").map((browser) => browser.trim().toLowerCase())
    : [];

  // Move to doc-detective-core directory to correctly set browser snapshot directory
  cwd = process.cwd();
  process.chdir(path.join(__dirname, ".."));

  // Meta
  const browser_platform = browsers.detectBrowserPlatform();
  const cacheDir = path.resolve("browser-snapshots");

  // Install Chrome and ChromeDriver
  if (specifiedBrowsers.length === 0 || specifiedBrowsers.includes("chrome")) {
    try {
      console.log("Installing Chrome browser and ChromeDriver binary");
      let browser = "chrome";
      buildId = await browsers.resolveBuildId(
        browser,
        browser_platform,
        "stable"
      );
      const chromeInstall = await browsers.install({
        browser,
        buildId,
        cacheDir,
      });

      browser = "chromedriver";
      buildId = await browsers.resolveBuildId(
        browser,
        browser_platform,
        "stable"
      );
      const chromeDriverInstall = await browsers.install({
        browser,
        buildId,
        cacheDir,
      });
    } catch (e) {
      console.log("Chrome or ChromeDriver download not available.");
    }
  }

  // Install Firefox and Geckodriver
  if (specifiedBrowsers.length === 0 || specifiedBrowsers.includes("firefox")) {
    try {
      console.log("Installing Firefox browser and Geckodriver binary");
      let browser = "firefox";
      buildId = await browsers.resolveBuildId(
        browser,
        browser_platform,
        "latest"
      );
      const firefoxInstall = await browsers.install({
        browser,
        buildId,
        cacheDir,
      });

      if (__dirname.includes("AppData\\Roaming\\")) {
        // Running from global install on Windows
        binPath = path.join(__dirname.split("node_modules")[0]);
      } else if (__dirname.includes("node_modules")) {
        // If running from node_modules
        binPath = path.join(__dirname, "../../.bin");
      } else {
        binPath = path.join(__dirname, "../node_modules/.bin");
      }
      process.env.GECKODRIVER_CACHE_DIR = binPath;
      const geckoInstall = await geckodriver.download();
    } catch (e) {
      console.log("Firefox or Geckodriver download not available.");
    }
  }

  // Install EdgeDriver
  if (specifiedBrowsers.length === 0 || specifiedBrowsers.includes("edge")) {
    try {
      console.log("Installing EdgeDriver binary");
      const edgeDriverPath = await edgedriver.download();
    } catch (e) {
      console.log("Edge browser not available.");
    }
  }

  // Move back to original directory
  process.chdir(cwd);
}
