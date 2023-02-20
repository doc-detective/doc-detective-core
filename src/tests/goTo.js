const { setEnvs, loadEnvs } = require("../utils");
const { schemas, validate } = require("../../../doc-detective-common");

exports.goTo = goTo;

action = { action: "goTo" } ;
validate("goTo_v1", action)
console.log(action);
return
// Open a URI in the browser
async function goTo(action, driver) {
  let result = { status: "", description: "" };

  // Validate action payload
  isValidAction = validate("goTo_v1", action);
  if (!isValidAction.valid) {
    result.status = "Invalid action.";
    result.description = errors[0].message;
    return { result };
  }

  // Load values from environment variables
  action = loadEnvs(action);

  // Catch common formatting errors
  if (!uri.includes("://")) uri = "https://" + uri;
  
  // Run action
  try {
    await driver.url(uri);
  } catch {
    // FAIL: Error opening URI
    let status = "FAIL";
    let description = "Couldn't open URI.";
    let result = { status, description };
    return { result };
  }
  // PASS
  let status = "PASS";
  let description = "Opened URI.";
  result = { status, description };
  return { result };
}
