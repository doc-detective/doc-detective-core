const { validate } = require("doc-detective-common");
const { typeKeys } = require("./typeKeys");

exports.findElement = findElement;

// Find a single element
async function findElement(config, step, driver) {
  let result = {
    status: "PASS",
    description: "Found an element matching selector.",
  };

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
  if (step.matchText) {
    const text = await element.getText();
    if (text !== step.matchText) {
      result.status = "FAIL";
      result.description = `Element text ("${text}") didn't equal match text ("${step.matchText}").`;
      return result;
    }
    result.description = result.description + " Matched text.";
  }

  // Move to element
  if (step.moveTo) {
    // TODO: Add offset options. https://webdriver.io/docs/api/element/moveTo
    await element.moveTo();
    result.description = result.description + " Moved to element.";
  }

  // Click element
  if (step.click) {
    try {
      // TODO: Split into separate action with button and coordinates options. https://webdriver.io/docs/api/element/click
      await element.click();
      result.description = result.description + " Clicked element.";
    } catch {
      // Couldn't click
      result.status = "FAIL";
      result.description = "Couldn't click element.";
      return result;
    }
  }

  // Type keys
  if (step.typeKeys) {
    typeStep = {
      action: "typeKeys",
      keys: step.typeKeys.keys,
    };
    typeResult = await typeKeys(config, typeStep, driver);
    if (typeResult.status === "FAIL") {
      result.status = "FAIL";
      result.description = `${result.description} ${typeResult.description}`;
    } else {
      result.description = result.description + " Typed keys.";
    }
  }

  // PASS
  return result;
}
