const { validate } = require("doc-detective-common");
const { instantiateCursor } = require("./moveTo");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo({ config, step, driver }) {
  let result = { status: "PASS", description: "Opened URL." };

  // Resolve to object
  if (typeof step.goTo === "string") {
    step.goTo = { url: step.goTo };
  }

  // If `origin` is set, prepend `url` with `origin`
  if (step.goTo.origin) {
    // If `url` doesn't begin with '/', add it
    if (!step.goTo.url.startsWith("/")) step.goTo.url = "/" + step.goTo.url;
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
