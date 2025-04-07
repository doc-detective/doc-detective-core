const { validate } = require("doc-detective-common");
const { clickElement } = require("./click");
const { typeKeys } = require("./typeKeys");
const { moveTo } = require("./moveTo");
const { wait } = require("./wait");

exports.findElement = findElement;

async function findElementBySelectorOrText({ string, driver }) {
  // Find an element based on a string that could either be a selector or element text
  // Perform searches for both concurrently
  // Prefer a selector match over a text match
  const timeout = 5000;
  const selectorPromise = driver.$(string);
  const textPromise = driver.$(`//*[text()="${string}"]`);
  // Wait for both promises to resolve

  const results = await Promise.allSettled([
    selectorPromise
      .waitForExist({ timeout })
      .then(() => selectorPromise)
      .catch(() => null),
    textPromise
      .waitForExist({ timeout })
      .then(() => textPromise)
      .catch(() => null),
  ]);

  const selectorResult =
    results[0].status === "fulfilled" ? results[0].value : null;
  const textResult =
    results[1].status === "fulfilled" ? results[1].value : null;

  let result;
  // Check if selectorResult is a valid element
  if (selectorResult && selectorResult.elementId) {
    result = { element: selectorResult, foundBy: "selector" };
    return result;
  }
  // Check if textResult is a valid element
  if (textResult && textResult.elementId) {
    result = { element: textResult, foundBy: "text" };
    return result;
  }
  // No matching elements
  return null;
}

async function findElementBySelectorAndText({
  selector,
  text,
  timeout,
  driver,
}) {
  let element;
  if (!selector && !text) {
    return null;
  }
  // Wait  timeout milliseconds
  await driver.pause(timeout);
  // Find an element based on a selector and text
  // Elements must match both selector and text
  let elements = await driver.$$(selector);
  elements = await elements.filter(
    async (el) => (await el.getText()) === text && el.elementId
  );
  if (elements.length === 0) {
    return null; // No matching elements
  }
  // If multiple elements match, return the first one
  element = elements[0];
  return { element, foundBy: "selector and text" };
}

// Find a single element
async function findElement({ config, step, driver }) {
  let result = {
    status: "PASS",
    description: "Found an element matching selector.",
    outputs: {},
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
          result.status = "FAIL";
          result.description = "No elements matched selector or text.";
          return result;
        }
      }
      result.outputs.element = element;
      result.description += ` Found element by ${foundBy}.`;
      return result;
    } else {
      // No matching elements
      result.status = "FAIL";
      result.description = "No elements matched selector or text.";
      return result;
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
      result.outputs.element = element;
      result.description += ` Found element by ${foundBy}.`;
    } else {
      // No matching elements
      result.status = "FAIL";
      result.description = "No elements matched selector and text.";
      return result;
    }
  } else if (step.find.selector) {
    element = await driver.$(step.find.selector);
  } else if (step.find.elementText) {
    element = await driver.$(`//*[text()="${step.find.elementText}"]`);
  } else {
    // No selector or text
    result.status = "FAIL";
    result.description = "No selector or text provided.";
    return result;
  }
  
  // Wait for timeout
  try {
    await element.waitForExist({ timeout: step.find.timeout });
  } catch {
  }
  
  // No matching elements
  if (!element.elementId) {
    result.status = "FAIL";
    result.description = "No elements matched selector and/or text.";
    return result;
  }

  // Set element in outputs
  result.outputs.element = element;

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
    result.description = result.description + " Moved to element.";
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
    if (clickResult.status === "FAIL") {
      result.status = "FAIL";
      result.description += clickResult.description;
    } else {
      result.description += " Clicked element.";
    }
  }

  // Type keys
  if (step.find.type) {
    const typeStep = {
      type: {
        keys: step.find.type.keys || step.find.type,
      },
    };
    const typeResult = await typeKeys({
      config: config,
      step: typeStep,
      driver: driver,
    });
    if (typeResult.status === "FAIL") {
      result.status = "FAIL";
      result.description = `${result.description} ${typeResult.description}`;
    } else {
      result.description += " Typed keys.";
    }
  }

  // If recording, wait until page is loaded and instantiate cursor
  if (config.recording) {
    await wait({ config: config, step: { wait: 2000 }, driver: driver });
  }
  // PASS
  return result;
}
