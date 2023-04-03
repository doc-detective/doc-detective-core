const { validate } = require("doc-detective-common");
const arch = require("arch");
const { log } = require("./utils")
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
    log(config, "error", `Invalid config object: ${validityCheck.errors}. Exiting.`);
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
