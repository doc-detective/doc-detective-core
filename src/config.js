const { validate } = require("doc-detective-common");
const arch = require("arch");
const { log, spawnCommand } = require("./utils");
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
  config.environment.apps = await getAvailableApps();

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
async function getAvailableApps() {
  const { BROWSERS } = await import("@eyeo/get-browser-binary");

  const apps = {
    // androidStudio: "",
    chromium: "",
    chrome: "",
    // edge: "",
    firefox: "",
    // iOsSimulator: "",
    // obs: "",
    // safari: "",
  };

  // Detect Chromium
  try {
    // Get internal dependency path
    chromium = await BROWSERS.chromium.installBrowser("latest");
    apps.chromium = chromium.binary;
  } catch {}
  if (!chromium) {
  // Check external default install locations
    apps.chromium = await getInstallPath(
      config,
      defaultAppIDs.chromium[config.environment.platform]
    );
  }

  // Detect Firefox
  try {
    // Get internal dependency path
    firefox = await BROWSERS.firefox.installBrowser("latest");
    apps.firefox = firefox.binary;
  } catch {  }
  if (!apps.firefox) {
    // Check external default install locations
    apps.firefox = await getInstallPath(
      config,
      defaultAppIDs.firefox[config.environment.platform] 
    );
  }

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
    installPath = appPath;
  } catch {}
  return installPath;
}
