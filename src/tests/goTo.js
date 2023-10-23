const { validate } = require("doc-detective-common");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo(config, step, driver) {
  let result = { status: "PASS", description: "Opened URL." };

  // Make sure there's a protocol
  if (step.url && !step.url.includes("://")) step.url = "https://" + step.url;

  // Validate step payload
  isValidStep = validate("goTo_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // If `origin` is set, prepend `url` with `origin`
  if (step.origin) {
    // If `url` doesn't begin with '/', add it
    if (!step.url.startsWith("/")) step.url = "/" + step.url;
    step.url = step.origin + step.url;
    // Validate step payload
    isValidStep = validate("goTo_v2", step);
    if (!isValidStep.valid) {
      result.status = "FAIL";
      result.description = `Invalid 'origin' and 'url' combination: ${isValidStep.errors}`;
      return result;
    }
  }

  // Run action
  try {
    await driver.url(step.url);
  } catch {
    // FAIL: Error opening URL
    result.status = "FAIL";
    result.description = "Couldn't open URL.";
    return result;
  }

  // PASS
  return result;
}
