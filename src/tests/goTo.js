const { validate } = require("doc-detective-common");
const { isRelativeUrl } = require("../utils");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo({ config, step, driver }) {
  step = { ...step, result: "PASS", resultDescription: "Opened URL." };

  // Resolve to object
  if (typeof step.goTo === "string") {
    step.goTo = { url: step.goTo };
  }

  // Set origin for relative URLs
  if (isRelativeUrl(step.goTo.url)) {
    if (!step.goTo.origin && !config.origin) {
      step.result = "FAIL";
      step.resultDescription =
        "Relative URL provided without origin. Specify an origin in either the step or the config.";
      return step;
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
    step.result = "FAIL";
    step.resultDescription = `Invalid step definition: ${isValidStep.errors}`;
    return step;
  }

  // Run action
  try {
    await driver.url(step.goTo.url);
    
    // Wait for page to completely load
    // TODO: Add goTo.timeout to step definition
    try {
      await driver.waitUntil(
        async () => {
          const readyState = await driver.execute(() => {
            return document.readyState;
          });
          return readyState === "complete";
        },
        { timeout: step.goTo.timeout || 15000 }
      );
    } catch (timeoutError) {
      // The page took too long to load, but we'll still proceed
      step.result = "WARNING";
      step.resultDescription = "Opened URL, but page didn't fully load within the timeout period.";
    }
  } catch (error) {
    // FAIL: Error opening URL
    step.result = "FAIL";
    step.resultDescription = `Couldn't open URL: ${error.message}`;
    return step;
  }

  // PASS
  return step;
}
