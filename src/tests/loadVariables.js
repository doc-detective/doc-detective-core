const { validate } = require("doc-detective-common");
const { loadEnvs } = require("../utils");

exports.loadVariables = loadVariables;

/**
 * Loads variables defined in a step object into the environment.
 * @async
 * @param {Object} step - The step object containing variable definitions.
 * @param {Object} step.loadVariables - The variables to be loaded.
 * @returns {Promise<Object>} A result object indicating success or failure.
 * @returns {string} result.status - "PASS" if successful, "FAIL" otherwise.
 * @returns {string} result.description - Description of the result or error message.
 */
async function loadVariables(step) {
  let result = { status: "PASS", description: "Set variables." };

  // Validate step payload
  isValidStep = validate("loadVariables_v3", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  setResult = loadEnvs(step.loadVariables);
  if (setResult === "FAIL") {
    // FAIL: Error setting variables
    result.status = "FAIL";
    result.description = "Couldn't set variables.";
    return result;
  }

  // PASS
  return result;
}
