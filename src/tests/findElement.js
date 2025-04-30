const { validate } = require("doc-detective-common");
const {
  findElementBySelectorOrText,
  findElementBySelectorAndText,
} = require("./findStrategies");
const { clickElement } = require("./click");
const { typeKeys } = require("./typeKeys");
const { moveTo } = require("./moveTo");
const { wait } = require("./wait");

exports.findElement = findElement;

async function setOutputs({ element }) {
  // Set element in outputs
  const outputs = {};
  outputs.element = element;
  outputs.element.text = await element.getText();
  return outputs;
}

// Find a single element
async function findElement({ config, step, driver }) {
  step = {
    ...step,
    status: "PASS",
    resultDescription: "Found an element matching selector.",
    outputs: {},
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

  // Handle combo selector/text string
  if (typeof step.find === "string") {
    const { element, foundBy } = await findElementBySelectorOrText({
      string: step.find,
      driver,
    });
    if (element) {
      try {
        // Wait for timeout
        await element.waitForExist({ timeout: 5000 });
      } catch {
        // No matching elements
        if (!element.elementId) {
          step.result = "FAIL";
          step.resultDescription = "No elements matched selector or text.";
          return step;
        }
      }
      step.outputs.element = element;
      step.resultDescription += ` Found element by ${foundBy}.`;
      step.outputs = await setOutputs({ element });
      return step;
    } else {
      // No matching elements
      step.result = "FAIL";
      step.resultDescription = "No elements matched selector or text.";
      return step;
    }
  }
  // Apply default values
  step.find = {
    ...step.find,
    selector: step.find.selector || "",
    timeout: step.find.timeout || 5000,
    elementText: step.find.elementText || "",
    moveTo: step.find.moveTo || false,
    click: step.find.click || false,
    type: step.find.type || false,
  };

  // Find element (and match text)
  let element;
  if (step.find.selector && step.find.elementText) {
    const { element: foundElement, foundBy } =
      await findElementBySelectorAndText({
        selector: step.find.selector,
        text: step.find.elementText,
        timeout: step.find.timeout,
        driver,
      });
    if (foundElement) {
      element = foundElement;
      step.outputs.element = element;
      step.resultDescription += ` Found element by ${foundBy}.`;
    } else {
      // No matching elements
      step.result = "FAIL";
      step.resultDescription = "No elements matched selector and text.";
      return step;
    }
  } else if (step.find.selector) {
    element = await driver.$(step.find.selector);
    try {
      await element.waitForExist({ timeout: step.find.timeout });
    } catch {}
  } else if (step.find.elementText) {
    element = await driver.$(`//*[text()="${step.find.elementText}"]`);
    try {
      await element.waitForExist({ timeout: step.find.timeout });
    } catch {}
  } else {
    // No selector or text
    step.result = "FAIL";
    step.resultDescription = "No selector or text provided.";
    return step;
  }

  // No matching elements
  if (!element.elementId) {
    step.result = "FAIL";
    step.resultDescription = "No elements matched selector and/or text.";
    return step;
  }

  // Set element in outputs
  step.outputs = await setOutputs({ element });

  // Move to element
  if (step.find.moveTo) {
    let moveToStep = {
      action: "moveTo",
      selector: step.find.selector,
      alignment: "center",
      offset: {
        x: 0,
        y: 0,
      },
    };

    await moveTo({ config, step: moveToStep, driver, element });
    step.resultDescription = step.resultDescription + " Moved to element.";
  }

  // Click element
  if (step.find.click) {
    const clickStep = {
      click: {
        button: step.find.click?.button || "left",
        selector: step.find.selector,
        elementText: step.find.elementText,
      },
    };
    const clickResult = await clickElement({
      config: config,
      step: clickStep,
      driver: driver,
      element: element,
    });
    if (clickResult.result === "FAIL") {
      step.result = "FAIL";
      step.resultDescription += clickResult.resultDescription;
    } else {
      step.resultDescription += " Clicked element.";
    }
  }

  // Type keys
  if (step.find.type) {
    const typeStep = {
      type: step.find.type,
    };
    const typeResult = await typeKeys({
      config: config,
      step: typeStep,
      driver: driver,
    });
    if (typeResult.result === "FAIL") {
      step.result = "FAIL";
      step.resultDescription = `${step.resultDescription} ${typeResult.resultDescription}`;
    } else {
      step.resultDescription += " Typed keys.";
    }
  }

  // If recording, wait until page is loaded and instantiate cursor
  if (config.recording) {
    await wait({ config: config, step: { wait: 2000 }, driver: driver });
  }
  // PASS
  return step;
}
