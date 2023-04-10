const { validate } = require("doc-detective-common");
const arch = require("arch");
const { log, spawnCommand, setEnvs, loadEnvs } = require("./utils");
const { exit } = require("process");
const path = require("path");

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
  }

  // Detect current environment.
  config.environment = getEnvironment();
  config.environment.apps = await getAvailableApps(config);

  return config;
}

// Detect aspects of the environment running Doc Detective.
function getEnvironment() {
  const environment = {};
  // Detect system architecture
  environment.arch = arch();
  // Detect system platform
  environment.platform = platformMap[process.platform];
  return environment;
}

// Detect available apps.
async function getAvailableApps(config) {
  const { BROWSERS } = await import("@eyeo/get-browser-binary");

  const apps = [];

  // Detect Chrome/Chromium
  // try {
  //   // Get internal dependency path
  //   chrome = await BROWSERS.chromium.installBrowser("latest");
  //   chrome = chrome.binary;
  // } catch {}
  // if (!chrome) {
  //   // Check external default install locations for Chromium
  //   chrome = await getInstallPath(
  //     config,
  //     defaultAppIDs.chromium[config.environment.platform]
  //   );
  //   if (!chrome) {
  //     // Check external default install locations for Chrome
  //     chrome = await getInstallPath(
  //       config,
  //       defaultAppIDs.chrome[config.environment.platform]
  //     );
  //   }
  // }
  // if (chrome) apps.push({ name: "chrome", path: chrome });

  // Detect Firefox
  let firefox = "";
  try {
    // Get internal dependency path
    firefox = await BROWSERS.firefox.installBrowser("latest");
    firefox = firefox.binary;
  } catch {}
  if (!firefox) {
    // Check external default install locations
    firefox = await getInstallPath(
      config,
      defaultAppIDs.firefox[config.environment.platform]
    );
  }
  if (firefox) apps.push({ name: "firefox", path: firefox });

  // TODO
  // Detect Chromium/Chrome
  // Detect Edge
  // Detect Safari
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
  } catch {}
  return installPath;
}
