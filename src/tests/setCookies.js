const { validate } = require("doc-detective-common");

exports.setCookies = setCookies;

// Open a URI in the browser
async function setCookies(config, step, driver) {
  let result = { status: "PASS", description: "Set cookies." };

  // Check if cookies are stringified JSON
  if (step.cookies && typeof step.cookies === "string") {
    try {
      step.cookies = JSON.parse(step.cookies);
    } catch {
      result.status = "FAIL";
      result.description = "Couldn't parse cookies.";
      return result;
    }
  }

  // Validate step payload
  isValidStep = validate("setCookies_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  try {
    await driver.setCookies(step.cookies);
  } catch {
    // FAIL: Error getting cookies
    result.status = "FAIL";
    result.description = "Couldn't set cookies.";
    return result;
  }
  
  // PASS
  return result;
}
