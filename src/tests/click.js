const { validate } = require("doc-detective-common");
const { findElementBySelectorAndText } = require("./findStrategies");

exports.clickElement = clickElement;

// Click an element.
async function clickElement({ config, step, driver, element }) {
  const result = {
    status: "PASS",
    description: "Clicked element.",
  };

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }
  // Accept coerced and defaulted values
  step = isValidStep.object;
  // Set default values
  step.click = {
    ...step.click,
    button: step.click.button || "left",
  };

  if (!element?.elementId) {
    // Find element
    const { element: foundElement, foundBy } = await findElementBySelectorAndText({
      selector: step.click.selector,
      text: step.click.elementText,
      timeout: step.click.timeout || 5000,
      driver,
    });
    if (!foundElement) {
      result.status = "FAIL";
      result.description = `Couldn't find element.`;
      return result;
    }
    element = foundElement;
    result.description += ` Found element by ${foundBy}.`;
  }

  try {
    await element.click({
      button: step.click.button,
    });
    result.description += " Clicked element.";
  } catch (error) {
    result.status = "FAIL";
    result.description = `Couldn't click element. Error: ${error.message}`;
    return result;
  }
  // PASS
  return result;
}
