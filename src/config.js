const os = require("os");
const { validate } = require("doc-detective-common");
const { log, spawnCommand, setEnvs, replaceEnvs } = require("./utils");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const browsers = require("@puppeteer/browsers");
const edgedriver = require("edgedriver");
const geckodriver = require("geckodriver");
const { setAppiumHome } = require("./appium");
const { loadDescription } = require("./openapi");

exports.setConfig = setConfig;
exports.getAvailableApps = getAvailableApps;

// Map of Node-detected platforms to common-term equivalents
const platformMap = {
  darwin: "mac",
  linux: "linux",
  win32: "windows",
};

// List of default apps to check for
const defaultAppIDs = {
  chromium: {
    linux: "chromium-browser",
    mac: "org.chromium.Chromium",
    windows: "chromium",
  },
  firefox: {
    linux: "firefox",
    mac: "org.mozilla.firefox",
    windows: "firefox",
  },
  chrome: {
    linux: "google-chrome",
    mac: "org.google.Chrome",
    windows: "chrome",
  },
};

// Validate config and set extra internal-only values.
async function setConfig(config) {
  // Set environment variables from file
  if (config.loadVariables) await setEnvs(config.loadVariables);

  // Load environment variables for `config`
  config = replaceEnvs(config);

  // Validate inbound `config`.
  const validityCheck = validate("config_v2", config);
  if (!validityCheck.valid) {
    // TODO: Improve error message reporting.
    log(
      config,
      "error",
      `Invalid config object: ${validityCheck.errors}. Exiting.`
    );
    process.exit(1);
  }

  // Standardize value formats
  // Convert `input` into array
  if (typeof config.input === "string") config.input = [config.input];
  if (config.runTests) {
    // Convert `runTests.input` into array
    if (config.runTests.input && typeof config.runTests.input === "string")
      config.runTests.input = [config.runTests.input];
    // Convert `runTests.setup` into array
    if (config.runTests.setup && typeof config.runTests.setup === "string")
      config.runTests.setup = [config.runTests.setup];
    // Convert `runTests.cleanup` into array
    if (config.runTests.cleanup && typeof config.runTests.cleanup === "string")
      config.runTests.cleanup = [config.runTests.cleanup];
  } else {
    // If `runTests` is not defined, set it to an empty object.
    config.runTests = {};
  }
  // Set download/media directories
  config.runTests.downloadDirectory =
    config.runTests?.downloadDirectory ||
    config.runTests?.output ||
    config.output;
  config.runTests.downloadDirectory = path.resolve(
    config.runTests.downloadDirectory
  );
  config.runTests.mediaDirectory =
    config.runTests?.mediaDirectory || config.runTests?.output || config.output;
  config.runTests.mediaDirectory = path.resolve(config.runTests.mediaDirectory);

  // Detect current environment.
  config.environment = getEnvironment();
  config.environment.apps = await getAvailableApps(config);
  await loadDescriptions(config);

  return config;
}

async function loadDescriptions(config) {
  if (config?.integrations?.openApi) {
    for (const openApiConfig of config.integrations.openApi) {
      try {
        openApiConfig.definition = await loadDescription(
          openApiConfig.descriptionPath
        );
      } catch (error) {
        log(
          config,
          "error",
          `Failed to load OpenAPI description from ${openApiConfig.descriptionPath}: ${error.message}`
        );
        // Remove the failed OpenAPI configuration
        config.integrations.openApi = config.integrations.openApi.filter(
          (item) => item !== openApiConfig
        );
      }
    }
  }
}

// Detect aspects of the environment running Doc Detective.
function getEnvironment() {
  const environment = {};
  // Detect system architecture
  environment.arch = os.arch();
  // Detect system platform
  environment.platform = platformMap[process.platform];
  return environment;
}

// Detect available apps.
async function getAvailableApps(config) {
  setAppiumHome();
  cwd = process.cwd();
  process.chdir(path.join(__dirname, ".."));
  const apps = [];

  const installedBrowsers = await browsers.getInstalledBrowsers({
    cacheDir: path.resolve("browser-snapshots"),
  });
  const installedAppiumDrivers = await spawnCommand("npx appium driver list");

  // Detect Chrome
  const chrome = installedBrowsers.find(
    (browser) => browser.browser === "chrome"
  );
  const chromeVersion = await getChromiumVersion(chrome.executablePath);
  const chromedriver = installedBrowsers.find(
    (browser) => browser.browser === "chromedriver"
  );
  const appiumChromium = installedAppiumDrivers.stderr.match(
    /\n.*chromium.*installed \(npm\).*\n/
  );

  if (chrome && chromedriver && appiumChromium) {
    apps.push({
      name: "chrome",
      version: chromeVersion,
      path: chrome.executablePath,
      driver: chromedriver.executablePath,
    });
  }

  // Detect Firefox
  const firefox = installedBrowsers.find(
    (browser) => browser.browser === "firefox"
  );
  const appiumFirefox = installedAppiumDrivers.stderr.match(
    /\n.*gecko.*installed \(npm\).*\n/
  );

  if (firefox && appiumFirefox) {
    apps.push({
      name: "firefox",
      version: firefox.buildId,
      path: firefox.executablePath,
    });
  }

  // Detect Edge
  let edgeDriverPath;
  try {
    edgeDriverPath = await edgedriver.download();
    if (edgeDriverPath && appiumChromium) {
      apps.push({
        name: "edge",
        version: "",
        path: "",
        driver: edgeDriverPath,
      });
    }
  } catch {
    // Edge not available
  }

  // Detect Safari
  if (config.environment.platform === "mac") {
    const safariVersion = await spawnCommand(
      "defaults read /Applications/Safari.app/Contents/Info.plist CFBundleShortVersionString"
    );
    const appiumSafari = installedAppiumDrivers.stderr.match(
      /\n.*safari.*installed \(npm\).*\n/
    );

    if (safariVersion.exitCode === 0 && appiumSafari) {
      apps.push({ name: "safari", version: safariVersion, path: "" });
    }
  }

  // Return to original working directory after finishing with `BROWSERS`
  process.chdir(cwd);

  // TODO
  // Detect Android Studio
  // Detect iOS Simulator

  return apps;
}

// Detect version of Chromium-based browser.
const getChromiumVersion = async (browserPath = "") => {
  if (!browserPath) return;
  browserPath = path.resolve(browserPath);
  let version;
  // Windows
  if (process.platform === "win32") {
    const command = `powershell -command "&{(Get-Item '${browserPath}').VersionInfo.ProductVersion}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`);
        console.error(stderr);
        return;
      }
      version = stdout.trim();
    });
  }
  // Mac and Linux
  else {
    const command = `"${browserPath}" --version`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${command}`);
        console.error(stderr);
        return;
      }
      version = stdout.trim().split(" ")[-1];
    });
  }

  return version;
};
