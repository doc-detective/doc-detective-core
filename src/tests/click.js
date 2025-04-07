const { validate } = require("doc-detective-common");
const { findElement } = require("./findElement");

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
    const findStep = {
      find: {
        selector: step.click.selector,
        elementText: step.click.elementText,
      },
    };
    // Find element
    const findResult = await findElement({
      config,
      step: findStep,
      driver,
    });
    if (findResult.status === "FAIL") {
      return findResult;
    }
    element = findResult.outputs.element;
    if (!element) {
      result.status = "FAIL";
      result.description = `Couldn't find element.`;
      return result;
    }
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
