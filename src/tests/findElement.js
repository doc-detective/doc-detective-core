const { validate } = require("doc-detective-common");
const { typeKeys } = require("./typeKeys");
const { moveTo, instantiateCursor } = require("./moveTo");

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
    const text = (await element.getText()) || (await element.getValue());
    if (text !== step.matchText) {
      result.status = "FAIL";
      result.description = `Element text (${text}) didn't equal match text (${step.matchText}).`;
      return result;
    }
    result.description = result.description + " Matched text.";
  }

  // Move to element
  if (step.moveTo && config.recording) {
    const moveToStep = {
      action: "moveTo",
      selector: step.selector,
    };
    if (typeof step.moveTo === "object") {
      moveToStep = { ...moveToStep, ...step.moveTo };
    }

    await moveTo(config, moveToStep, driver);
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
    const typeStep = {
      action: "typeKeys",
      keys: step.typeKeys.keys || step.typeKeys,
    };
    typeResult = await typeKeys(config, typeStep, driver);
    if (typeResult.status === "FAIL") {
      result.status = "FAIL";
      result.description = `${result.description} ${typeResult.description}`;
    } else {
      result.description = result.description + " Typed keys.";
    }
  }

  // If recording, wait until page is loaded and instantiate cursor
  // if (config.recording) {
  //   await instantiateCursor(driver);
  // }
  // PASS
  return result;
}
