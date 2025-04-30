const { validate } = require("doc-detective-common");
const { loadEnvs } = require("../utils");

exports.loadVariables = loadVariables;

/**
 * Loads variables defined in a step object into the environment.
 * @async
 * @param {Object} step - The step object containing variable definitions.
 * @param {Object} step.loadVariables - The variables to be loaded.
 * @returns {Promise<Object>} A result object indicating success or failure.
 * @returns {string} result.result - "PASS" if successful, "FAIL" otherwise.
 * @returns {string} result.resultDescription - Description of the result or error message.
 */
async function loadVariables({ step }) {
  step = { ...step, result: "PASS", resultDescription: "Set variables." };

  // Validate step payload
  const isValidStep = validate({ schemaKey: "step_v3", object: step });
  if (!isValidStep.valid) {
    step.result = "FAIL";
    step.resultDescription = `Invalid step definition: ${isValidStep.errors}`;
    return step;
  }

  // Run action
  const setResult = await loadEnvs(step.loadVariables);
  if (setResult.result === "FAIL") {
    // FAIL: Error setting variables
    step.result = "FAIL";
    step.resultDescription = `Couldn't set variables. ${setResult.resultDescription}`;
    return step;
  }

  // PASS
  return step;
}
