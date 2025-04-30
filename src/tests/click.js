const { validate } = require("doc-detective-common");
const {
  findElementBySelectorAndText,
  findElementBySelectorOrText,
} = require("./findStrategies");

exports.clickElement = clickElement;

// Click an element.
async function clickElement({ config, step, driver, element }) {
  step = {
    ...step,
    result: "PASS",
    resultDescription: "Clicked element.",
  };

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    step.result = "FAIL";
    step.resultDescription = `Invalid step definition: ${isValidStep.errors}`;
    return step;
  }
  // Accept coerced and defaulted values
  step = isValidStep.object;

  if (typeof step.click === "object") {
    // Set default values
    step.click = {
      ...step.click,
      button: step.click.button || "left",
    };
  }

  // Find element
  if (!element?.elementId) {
    // Handle combo selector/text string
    if (typeof step.click === "string") {
      const { element: foundElement, foundBy } = await findElementBySelectorOrText({
        string: step.click,
        driver,
      });
      if (foundElement) {
        // Wait for timeout
        try {
          await foundElement.waitForExist({ timeout: 5000 });
        } catch {
          // No matching elements
          if (!foundElement.elementId) {
            step.result = "FAIL";
            step.resultDescription = "No elements matched selector or text.";
            return step;
          }
        }
        step.resultDescription += ` Found element by ${foundBy}.`;
        element = foundElement;
      } else {
        // No matching elements
        step.result = "FAIL";
        step.resultDescription = "No elements matched selector or text.";
        return step;
      }
    } else {
      const { element: foundElement, foundBy } =
        await findElementBySelectorAndText({
          selector: step.click.selector,
          text: step.click.elementText,
          timeout: step.click.timeout || 5000,
          driver,
        });
      if (!foundElement) {
        step.result = "FAIL";
        step.resultDescription = `Couldn't find element.`;
        return step;
      }
      element = foundElement;
      step.resultDescription += ` Found element by ${foundBy}.`;
    }
  }

  try {
    await element.click({
      button: step?.click?.button || "left",
    });
    step.resultDescription += " Clicked element.";
  } catch (error) {
    step.result = "FAIL";
    step.resultDescription = `Couldn't click element. Error: ${error.message}`;
    return step;
  }
  // PASS
  return step;
}
