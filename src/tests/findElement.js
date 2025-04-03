const { validate } = require("doc-detective-common");
const { typeKeys } = require("./typeKeys");
const { moveTo, instantiateCursor } = require("./moveTo");
const { wait } = require("./wait");

exports.findElement = findElement;

async function findElementBySelectorOrText({ string, driver }) {
  driver.url("https://www.duckduckgo.com/");
  // Find an element based on a string that could either be a selector or element text
  // Perform searches for both concurrently
  // Prefer a selector match over a text match
  const selectorPromise = driver.$(string);
  const textPromise = driver.$(`//*[text()="${string}"]`);
  const [selectorResult, textResult] = await Promise.all([
    selectorPromise,
    textPromise,
  ]);
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

async function findElementBySelectorAndText({ step, driver }) {}

// Find a single element
async function findElement({config, step, driver}) {
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
      result.outputs.element = element;
      return result;
    } else {
      // No matching elements
      result.status = "FAIL";
      result.description = "No elements matched selector.";
      return result;
    }
  }


  // Apply default values
  if (typeof step.find === "object") {
    step.find = {
      ...step.find,
      selector: step.find.selector || "",
      timeout: step.find.timeout || 5000,
      elementText: step.find.elementText || "",
      moveTo: step.find.moveTo || false,
      click: step.find.click || false,
      type: step.find.type || false,
    };
  }





  // Find element
  const element = await driver.$(step.find.selector);
  try {
    // Wait for timeout
    await element.waitForExist({ timeout: step.find.timeout });
  } catch {
    // No matching elements
    if (!element.elementId) {
      result.status = "FAIL";
      result.description = "No elements matched selector.";
      return result;
    }
  }

  // Match text
  const text = (await element.getText()) || (await element.getValue());
  // If step.find.matchText starts and ends with `/`, treat it as a regex
  if (step.find.matchText) {
    if (
      step.find.matchText.startsWith("/") &&
      step.find.matchText.endsWith("/")
    ) {
      const regex = new RegExp(step.find.matchText.slice(1, -1));
      if (regex.test(text)) {
        result.description = result.description + " Matched regex.";
      } else {
        result.status = "FAIL";
        result.description = `Element text (${text}) didn't match regex (${step.find.matchText}).`;
        return result;
      }
    } else {
      if (text === step.find.matchText) {
        result.description = result.description + " Matched text.";
      } else {
        result.status = "FAIL";
        result.description = `Element text (${text}) didn't equal match text (${step.find.matchText}).`;
        return result;
      }
    }
  }

  // Move to element
  if (step.find.moveTo && config.recording) {
    let moveToStep = {
      action: "moveTo",
      selector: step.find.selector,
    };
    if (typeof step.find.moveTo === "object") {
      moveToStep = { ...moveToStep, ...step.find.moveTo };
    }

    await moveTo(config, moveToStep, driver);
    result.description = result.description + " Moved to element.";
  }

  // Click element
  if (step.find.click) {
    try {
      const button = step.find.click.button || "left";
      // TODO: Split into separate action with button and coordinates options. https://webdriver.io/docs/api/element/click
      await element.click({ button });
      result.description = result.description + " Clicked element.";
    } catch {
      // Couldn't click
      result.status = "FAIL";
      result.description = "Couldn't click element.";
      return result;
    }
  }

  // Type keys
  if (step.find.type) {
    const typeStep = {
      type: {
        keys: step.find.type.keys || step.find.type,
      },
    };
    const typeResult = await typeKeys(config, typeStep, driver);
    if (typeResult.status === "FAIL") {
      result.status = "FAIL";
      result.description = `${result.description} ${typeResult.description}`;
    } else {
      result.description = result.description + " Typed keys.";
    }
  }

  // If recording, wait until page is loaded and instantiate cursor
  if (config.recording) {
    await wait(config, { action: "wait", duration: 2000 }, driver);
  }
  // PASS
  return result;
}
