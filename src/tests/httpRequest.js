const { validate } = require("doc-detective-common");
const axios = require("axios");
const jq = require("node-jq");

exports.httpRequest = httpRequest;

async function httpRequest(config, step) {
  let result = { status: "", description: "" };
  let request = { url: "", method: "" };

  // Make sure there's a protocol
  if (step.url && !step.url.includes("://")) step.url = "https://" + step.url;

  // Validate step payload
  isValidStep = validate("httpRequest_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  request.url = step.url;
  request.method = step.method;
  if (JSON.stringify(step.requestHeaders) != "{}")
    request.headers = step.requestHeaders;
  if (JSON.stringify(step.requestParams) != "{}")
    request.params = step.requestParams;
  if (JSON.stringify(step.requestData) != "{}") request.data = step.requestData;

  // Perform request
  const response = await axios(request)
    .then((response) => {
      return response;
    })
    .catch((error) => {
      return { error };
    });

  // If request returned an error
  if (response.error) {
    result.status = "FAIL";
    result.description = `Error: ${JSON.stringify(response.error.message)}`;
    return result;
  }

  // Compare status codes
  if (step.statusCodes.indexOf(response.status) >= 0) {
    result.status = "PASS";
    result.description = `Returned ${response.status}.`;
  } else {
    result.status = "FAIL";
    result.description = `Returned ${
      response.status
    }. Expected one of ${JSON.stringify(step.statusCodes)}`;
  }

  // Compare response.data and responseData
  if (JSON.stringify(step.responseData) != "{}") {
    dataComparison = objectExistsInObject(step.responseData, response.data);
    if (dataComparison.result.status === "PASS") {
      if (result.status != "FAIL") result.status = "PASS";
      result.description =
        result.description +
        ` Expected response data was present in actual response data.`;
    } else {
      result.status = "FAIL";
      result.description =
        result.description + " " + dataComparison.result.description;
    }
  }

  // Compare response.headers and responseHeaders
  if (JSON.stringify(step.responseHeaders) != "{}") {
    dataComparison = objectExistsInObject(
      step.responseHeaders,
      response.headers
    );
    if (dataComparison.result.status === "PASS") {
      if (result.status != "FAIL") result.status = "PASS";
      result.description =
        result.description +
        ` Expected response headers were present in actual response headers.`;
      result.status = "FAIL";
    } else {
      result.description =
        result.description + " " + dataComparison.result.description;
    }
  }

  // Set environment variables from response data
    for (const variable of step.envsFromResponseData) {
      let value = await jq.run(variable.jqFilter, response.data, {
        input: "json",
        output: "compact",
      });
      if (value) {
        process.env[variable.name] = value;
        result.description =
          result.description + ` Set '$${variable.name}' environment variable.`;
      } else {
        if (status != "FAIL") status = "WARNING";
        result.description =
          result.description +
          ` Couldn't set '${variable.name}' environment variable. The jq filter (${variable.jqFilter}) returned a null result.`;
      }
    }

  result.description = result.description.trim();
  return result;
}

function arrayExistsInArray(expected, actual) {
  let status = "PASS";
  let description = "";
  for (i = 0; i < expected.length; i++) {
    if (Array.isArray(expected[i])) {
      // Array
      //// Check if any arrays in actual
      // Gather info about array to make comparison
      numExpectedArrays = 0;
      numExpectedObjects = 0;
      expected[i].forEach((value) => {
        if (Array.isArray(value)) {
          numExpectedArrays++;
        } else if (typeof value === "object") {
          numExpectedObjects++;
        }
      });
      // Iterate through actual to find arrays that might match expected[i]
      arrayMatches = 0;
      arrayIndexMatches = [];
      actual.forEach((value) => {
        numActualArrays = 0;
        numActualObjects = 0;
        if (Array.isArray(value)) {
          value.forEach((item) => {
            if (Array.isArray(item)) {
              numActualArrays++;
            } else if (typeof value === "object") {
              numActualObjects++;
            }
          });
        }
        if (
          numActualArrays >= numExpectedArrays &&
          numActualObjects >= numExpectedObjects &&
          value.length >= expected[i].length
        ) {
          arrayIndexMatches.push(value);
        }
      });
      // Loop through and test potential array matches
      arrayIndexMatches.forEach((array) => {
        arrayMatchResult = arrayExistsInArray(expected[i], array);
        if (arrayMatchResult.result.status === "PASS") {
          arrayMatches++;
        }
      });
      if (!arrayMatches) {
        status = "FAIL";
        description =
          description +
          ` Array '${JSON.stringify(
            expected[i]
          )}' isn't present in expected array.`;
      }
    } else if (typeof expected[i] === "object") {
      // Object
      //// Check if any objects in actual
      keys = Object.keys(expected[i]);
      objectMatches = 0;
      objectKeyMatches = actual.filter(
        (value) =>
          // Is an object
          typeof value === "object" &&
          // Is not an array
          !Array.isArray(value) &&
          // Contains all the specified keys
          keys.every((key) => value.hasOwnProperty(key))
      );
      objectKeyMatches.forEach((object) => {
        objectMatchResult = objectExistsInObject(expected[i], object);
        if (objectMatchResult.result.status === "PASS") {
          objectMatches++;
        }
      });
      if (!objectMatches) {
        status = "FAIL";
        description =
          description +
          ` Object ${JSON.stringify(
            expected[i]
          )} isn't present in expected array.`;
      }
    } else {
      // Anything else that isn't present
      if (!actual.includes(expected[i])) {
        status = "FAIL";
        description =
          description +
          ` Value '${expected[i]}' isn't present in expected array.`;
      }
    }
  }
  result = { status, description };
  return { result };
}

function objectExistsInObject(expected, actual) {
  let status = "PASS";
  let description = "";
  Object.keys(expected).forEach((key) => {
    if (!actual.hasOwnProperty(key)) {
      // Key doesn't exist in actual
      description =
        description + `The '${key}' key did't exist in returned JSON. `;
      status = "FAIL";
    } else if (typeof expected[key] === "object") {
      if (Array.isArray(expected[key])) {
        // Punt to array comparison function
        result = arrayExistsInArray(expected[key], actual[key]);
        if (result.result.status === "FAIL") status = "FAIL";
        if (result.result.description != "")
          description = description + " " + result.result.description;
      } else {
        // Nested object recursion
        result = objectExistsInObject(expected[key], actual[key]);
        if (result.result.status === "FAIL") status = "FAIL";
        if (result.result.description != "")
          description = description + " " + result.result.description;
      }
    } else if (expected[key] != actual[key]) {
      // Actual value doesn't match expected
      description =
        description +
        `The '${key}' key did't match the expected value. Expected: '${expected[key]}'. Actual: '${actual[key]}'. `;
      status = "FAIL";
    }

    if (status === "FAIL") {
      description = description.trim();
    }
  });
  result = { status, description };
  return { result };
}
