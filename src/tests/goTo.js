const { validate } = require("doc-detective-common");
const { isRelativeUrl } = require("../utils");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo({ config, step, driver }) {
  let result = { status: "PASS", description: "Opened URL." };

  // Resolve to object
  if (typeof step.goTo === "string") {
    step.goTo = { url: step.goTo };
  }

  // Set origin for relative URLs
  if (isRelativeUrl(step.goTo.url)) {
    if (!step.goTo.origin && !config.origin) {
      result.status = "FAIL";
      result.description =
        "Relative URL provided without origin. Specify an origin in either the step or the config.";
      return result;
    }
    step.goTo.origin = step.goTo.origin || config.origin;
    // If there isn't the necessary slash, add it
    if (
      !step.goTo.origin.endsWith("/") &&
      !step.goTo.url.startsWith("/")
    ) {
      step.goTo.origin += "/";
    }
    step.goTo.url = step.goTo.origin + step.goTo.url;
  }

  // Make sure there's a protocol
  if (step.goTo.url && !step.goTo.url.includes("://"))
    step.goTo.url = "https://" + step.goTo.url;

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  try {
    await driver.url(step.goTo.url);
  } catch (error) {
    // FAIL: Error opening URL
    result.status = "FAIL";
    result.description = `Couldn't open URL: ${error.message}`;
    return result;
  }

  // PASS
  return result;
}
