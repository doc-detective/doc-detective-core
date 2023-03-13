const { validate } = require("../../../doc-detective-common");

exports.findElement = findElement;

// Find a single element
async function findElement(config, step, driver) {
  let result = { status: "", description: "", elementHandle: {} };

  // Validate step payload
  isValidStep = validate("find_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Find CSS selector
  result.elementHandle = await driver.$(step.selector);

  // No matching elements
  if (!result.elementHandle.elementId) {
    result.status = "FAIL",
    result.description = "No elements matched selector.";
    return result;
  }

  // PASS
  result.status = "PASS";
  result.description = "Found an element matching selector.";
  return result;
}
