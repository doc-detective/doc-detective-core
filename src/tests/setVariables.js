const { exit } = require("yargs");
const { validate } = require("../../../doc-detective-common");
const { setEnvs } = require("../utils");

exports.setVariables = setVariables;

// Open a URI in the browser
async function setVariables(config, step) {
  let result = { status: "PASS", description: "Set variables." };

  // Validate step payload
  isValidStep = validate("setVariables_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Run action
  setResult = setEnvs(step.path);
  if (setResult === "FAIL") {
    // FAIL: Error setting variables
    result.status = "FAIL";
    result.description = "Couldn't set variables.";
    return result;
  }

  // PASS
  return result;
}
