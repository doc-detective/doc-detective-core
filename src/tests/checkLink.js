const { validate } = require("doc-detective-common");
const axios = require("axios");

exports.checkLink = checkLink;

async function checkLink(config, step) {
  let result = { status: "", description: "" };

  // If `origin` is set, prepend `url` with `origin`
  if (step.origin) {
    // If `url` doesn't begin with '/', add it
    if (!step.url.startsWith("/")) step.url = "/" + step.url;
    step.url = step.origin + step.url;
  }
  
  // Make sure there's a protocol
  if (step.url && !step.url.includes("://")) step.url = "https://" + step.url;

  // Validate step payload
  isValidStep = validate("checkLink_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  // Perform request
  let req = await axios
    .get(step.url)
    .then((res) => {
      return { statusCode: res.status };
    })
    .catch((error) => {
      return { error };
    });

  // If request returned an error
  if (req.error) {
    result.status = "FAIL";
    result.description = `Invalid or unresolvable URL: ${step.url}`;
    return result;
  }

  // Compare status codes
  if (step.statusCodes.indexOf(req.statusCode) >= 0) {
    result.status = "PASS";
    result.description = `Returned ${req.statusCode}`;
  } else {
    result.status = "FAIL";
    result.description = `Returned ${
      req.statusCode
    }. Expected one of ${JSON.stringify(step.statusCodes)}`;
  }

  return result;
}
