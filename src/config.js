const os = require("os");
const { validate } = require("doc-detective-common");
const { log, spawnCommand, setEnvs, loadEnvs } = require("./utils");
const path = require("path");
const browsers = require("@puppeteer/browsers");

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
  if (config.envVariables) await setEnvs(config.envVariables);

  // Load environment variables for `config`
  config = loadEnvs(config);

  // Validate inbound `config`.
  const validityCheck = validate("config_v2", config);
  if (!validityCheck.valid) {
    // TODO: Improve error message reporting.
    log(
      config,
      "error",
      `Invalid config object: ${validityCheck.errors}. Exiting.`
    );
    exit(1);
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

  return config;
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
  cwd = process.cwd();
  process.chdir(path.join(__dirname, ".."));
  const apps = [];

  const installedBrowsers = await browsers.getInstalledBrowsers({cacheDir: path.resolve("browser-snapshots")});

  // Detect Chromium
  const chromium = installedBrowsers.find((browser) => browser.browser === "chromium");
  if (chromium) {
    apps.push({ name: "chromium", version: chromium.buildId, path: chromium.executablePath });
  }

  // Detect Chrome
  const chrome = installedBrowsers.find((browser) => browser.browser === "chrome");
  if (chrome) {
    apps.push({ name: "chrome", version: chrome.buildId, path: chrome.executablePath });
  }

  // Detect Firefox
  const firefox = installedBrowsers.find((browser) => browser.browser === "firefox");
  if (firefox) {
    apps.push({ name: "firefox", version: firefox.buildId, path: firefox.executablePath });
  }

  // Detect Safari
  if (config.environment.platform === "mac") {
    const safariVersion = await spawnCommand(
      "defaults read /Applications/Safari.app/Contents/Info.plist CFBundleShortVersionString"
    );
    if (safariVersion.exitCode === 0) {
      apps.push({ name: "safari", version: safariVersion, path: "" });
    }
  }

  // Return to original working directory after finishing with `BROWSERS`
  process.chdir(cwd);

  // TODO
  // Detect Edge
  // Detect Android Studio
  // Detect iOS Simulator
  // Detect OBS

  return apps;
}

// Get path to installed app. For mac, `id` is the bundle identifier. For linux, `id` is the binary name. For windows, `id` is the binary name.
async function getInstallPath(config, id) {
  let installPath = "";
  let command = "";
  switch (config.environment.platform) {
    case "mac":
      command = "mdfind";
      break;
    case "linux":
      command = "which";
      break;
    case "windows":
      command = "where";
      break;
  }
  try {
    const appPath = await spawnCommand(command, [id]);
    if (appPath.exitCode === 0) installPath = appPath.stdout;
  } catch { }
  return installPath;
}
