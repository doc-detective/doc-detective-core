const { validate } = require("doc-detective-common");

exports.getCookies = getCookies;

// Open a URI in the browser
async function getCookies(config, step, driver) {
  let result = { status: "PASS", description: "Got cookies." };

  // Validate step payload
  isValidStep = validate("getCookies_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  try {
    const cookies = await driver.getCookies();
    process.env[step.variableName] = JSON.stringify(cookies);
  } catch {
    // FAIL: Error getting cookies
    result.status = "FAIL";
    result.description = "Couldn't get cookies.";
    return result;
  }
  
  // PASS
  return result;
}
