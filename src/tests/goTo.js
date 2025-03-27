const { validate } = require("doc-detective-common");
const { instantiateCursor } = require("./moveTo");

exports.goTo = goTo;

// Open a URI in the browser
async function goTo({step, driver}) {
  let result = { status: "PASS", description: "Opened URL." };
  const goTo = step.goTo;

  // If `origin` is set, prepend `url` with `origin`
  if (goTo.origin) {
    // If `url` doesn't begin with '/', add it
    if (!goTo.url.startsWith("/")) goTo.url = "/" + goTo.url;
    goTo.url = goTo.origin + goTo.url;
  }

  // Make sure there's a protocol
  if (goTo.url && !goTo.url.includes("://")) goTo.url = "https://" + goTo.url;

  // Validate step payload
  const isValidStep = validate("step_v3", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  try {
    await driver.url(goTo.url);
  } catch (error) {
    // FAIL: Error opening URL
    result.status = "FAIL";
    result.description = `Couldn't open URL: ${error.message}`;
    return result;
  }

  // PASS
  return result;
}
