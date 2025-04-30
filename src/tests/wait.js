const { validate } = require("doc-detective-common");

exports.wait = wait;

// Open a URI in the browser
async function wait({ step }) {
  step = { ...step, result: "PASS", resultDescription: "Waited.", };

  // Validate step payload
  const isValidStep = validate({schemaKey: "step_v3", object: step});
  if (!isValidStep.valid) {
    step.result = "FAIL";
    step.resultDescription = `Invalid step definition: ${isValidStep.errors}`;
    return step;
  }

  // Resolve wait value
  if (step.wait === true || step.wait === "true") {
    // True boolean
    step.wait = 5000;
  } else if (step.wait === false || step.wait === "false") {
    step.result = "SKIPPED";
    step.resultDescription = "Wait skipped.";
    return step;
  } else if (typeof step.wait === "string") {
    // Convert to number
    const waitValue = parseInt(step.wait, 10);
    if (isNaN(waitValue)) {
      step.result = "FAIL";
      step.resultDescription = `Invalid wait value: ${step.wait}. Must be a number or boolean.`;
      return step;
    }
    // Set wait value
    step.wait = waitValue;
  }

  // Run action
  try {
    await new Promise((r) => setTimeout(r, step.wait));
  } catch (error) {
    // FAIL: Error waiting
    step.result = "FAIL";
    step.resultDescription = `Couldn't wait. ${error.message}`;
    return step;
  }

  // PASS
  step.result = "PASS";
  step.resultDescription = "Wait completed successfully.";
  return step;
}
