const os = require("os");
const { log } = require("./utils");
const { PostHog } = require("posthog-node");

const platformMap = {
  win32: "windows",
  darwin: "mac",
  linux: "linux",
};

// TODO: Add link to docs
function telemetryNotice(config) {
  if (config?.telemetry?.send === false) {
    log(config, "info",
      "Telemetry is disabled. Basic, anonymous telemetry helps Doc Detective understand product issues and usage. To enable telemetry, set 'telemetry.send' to 'true' in your .doc-detective.json config file."
    );
  } else {
    log(config, "info",
      "Doc Detective collects basic, anonymous telemetry to understand product issues and usage. To disable telemetry, set 'telemetry.send' to 'false' in your .doc-detective.json config file."
    );
  }

}

// meta = {
//   distribution: "doc-detective", // doc-detective, core
//   dist_platform: "windows", // windows, mac, linux
//   dist_platform_version: "10", // 10, 11, 12, 20.04, 21.04
//   dist_platform_arch: "x64", // x64, arm64, armv7l
//   dist_version: version,
//   dist_deployment: "node", // node, electron, docker, github-action, lambda, vscode-extension, browser-extension
//   dist_deployment_version: "18.19.0",
//   dist_interface: "cli", // cli, rest, gui, vscode
//   core_version: version,
//   core_platform: "windows", // windows, mac, linux
//   core_platform_version: "10", // 10, 11, 12, 20.04, 21.04
//   core_deployment: "node", // node, electron, docker, github-action, lambda, vscode-extension, browser-extension
// };

// Send telemetry data to PostHog
function sendTelemetry(config, command, results) {
  // Exit early if telemetry is disabled
  if (config?.telemetry?.send === false) return;

  // Assemble telemetry data
  const telemetryData =
    process.env["DOC_DETECTIVE_META"] !== undefined
      ? JSON.parse(process.env["DOC_DETECTIVE_META"])
      : {};
  const package = require("../package.json");
  telemetryData.core_version = package.version;
  telemetryData.core_platform = os.platform();
  telemetryData.core_platform_version = os.release();
  telemetryData.core_platform_arch = os.arch();
  telemetryData.core_deployment = telemetryData.core_deployment || "node";
  telemetryData.core_deployment_version =
    telemetryData.core_deployment_version || process.version;
  const distinctId = config?.telemetry?.userId || "anonymous";

  const event = { distinctId, event: command, properties: telemetryData };

  // Send telemetry
  const client = new PostHog(
    "phc_rjV0MH3nsAd45zFISLgaKAdAXbgDeXt2mOBV2EBHomB",
    { host: "https://app.posthog.com" }
  );
  client.capture(event);
  client.shutdown();
}

exports.telemetryNotice = telemetryNotice;
exports.sendTelemetry = sendTelemetry;
