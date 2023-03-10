const { validate } = require("doc-detective-common");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo(config, step, driver) {
  let result = { status: "", description: "" };

  // Make sure there's a protocol
  if (!step.url.includes("://")) step.url = "https://" + step.url;

  // Validate step payload
  isValidStep = validate("goTo_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  try {
    await driver.url(step.url);
  } catch {
    // FAIL: Error opening URL
    let status = "FAIL";
    let description = "Couldn't open URL.";
    let result = { status, description };
    return result;
  }
  // PASS
  let status = "PASS";
  let description = "Opened URIL.";
  result = { status, description };
  return result;
}
