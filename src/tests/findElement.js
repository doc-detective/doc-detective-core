const { validate } = require("../../../doc-detective-common");

exports.findElement = findElement;

// Find a single element
async function findElement(config, step, driver) {
  let result = { status: "", description: "" };

  // Validate step payload
  isValidStep = validate("find_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Find element
  const element = await driver.$(step.selector);
  try {
    // Wait for timeout
    await element.waitForExist({ timeout: step.timeout });
  } catch {
  // No matching elements
    if (!element.elementId) {
      result.status = "FAIL";
    result.description = "No elements matched selector.";
    return result;
    }
  }

  // Match text
  const text = await element.getText();
  if (text !== step.matchText) {
    result.status = "FAIL";
    result.description = `Element text ("${text}") didn't equal match text ("${step.matchText}").`;
    return result;
  }
  // PASS
  result.status = "PASS";
  result.description = "Found an element matching selector.";
  return result;
}
