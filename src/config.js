const { validate } = require("../../doc-detective-common");
const arch = require("arch");
const { exit } = require("process");

exports.setConfig = setConfig;

// Map of Node-detected platforms to common-term equivalents
const platformMap = {
  darwin: "mac",
  linux: "linux",
  win32: "windows",
};

// Validate config and set extra internal-only values.
function setConfig(config) {
  // Validate inbound `config`.
  const validityCheck = validate("config_v2", config);
  if (!validityCheck.valid) {
    // TODO: Improve error message reporting.
    log(config, "error", "Invalid config object. Exiting.");
    exit(1);
  }

  // Detect current environment.
  config.environment = getEnvironment();

  return config;
}

// Detect aspects of the environment running Doc Detective.
function getEnvironment() {
  const environment = {};
  environment.arch = arch();
  environment.platform = platformMap[process.platform];
  return environment;
}

// TODO: Move this to only check/install/load apps that are needed based on supplied specs.
async function getAvailableApps() {
  const { BROWSERS } = await import("@eyeo/get-browser-binary");

  const apps = {
    // androidStudio: "",
    chromium: "",
    // edge: "",
    firefox: "",
    // iOsSimulator: "",
    // obs: "",
    // safari: "",
  };

  // Detect Chromium
  try {
    // Get internal dependency path
    apps.chromium = await BROWSERS.chromium.installBrowser("latest").binary;
  } catch {
    // TODO: Detect based on default install locations per platform.
  }

  // Detect Firefox
  try {
    // Get internal dependency path
    apps.firefox = await BROWSERS.firefox.installBrowser("latest").binary;
  } catch {
    // TODO: Detect based on default install locations per platform.
  }

  return apps;
}
