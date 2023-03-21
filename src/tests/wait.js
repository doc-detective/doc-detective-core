const { validate } = require("doc-detective-common");

exports.wait = wait;

// Open a URI in the browser
async function wait(config, step) {
  let result = { status: "PASS", description: "Waited." };

  // Validate step payload
  isValidStep = validate("wait_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  try {
    await new Promise((r) => setTimeout(r, step.duration));
  } catch {
    // FAIL: Error waiting
    result.status = "FAIL";
    result.description = "Couldn't wait.";
    return result;
  }
  
  // PASS
  return result;
}
