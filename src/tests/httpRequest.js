const { validate } = require("doc-detective-common");
const axios = require("axios");
const jq = require("node-jq");
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const { getOperation, loadOpenApiDefinition } = require("../openapi");
const { log, calculatePercentageDifference } = require("../utils");

exports.httpRequest = httpRequest;

async function httpRequest(config, step) {
  let result = { status: "", description: "" };
  let openApiDefinition;
  let operation;

  // Identify OpenAPI definition
  if (step.openApi) {
    if (step.openApi.definitionPath) {
      // Load OpenAPI definition from step
      openApiDefinition = await loadOpenApiDefinition(
        step.openApi.definitionPath
      );
    } else if (step.openApi.name && config?.integrations?.openApi) {
      // Load OpenAPI definition from config
      integration = config.integrations.openApi.find(
        (openApiConfig) => openApiConfig.name === step.openApi.name
      );
      openApiDefinition = integration.definition;
      step.openApi = { ...integration, ...step.openApi };
      delete step.openApi.definition;
    } else if (config?.integrations?.openApi) {
      // Identify first definition that contains the operation
      for (const openApiConfig of config.integrations.openApi) {
        for (const path in openApiConfig.definition.paths) {
          for (const operation in openApiConfig.definition.paths[path]) {
            if (
              openApiConfig.definition.paths[path][operation].operationId ===
              step.openApi.operationId
            ) {
              openApiDefinition = openApiConfig.definition;
              step.openApi = { ...openApiConfig, ...step.openApi };
              delete step.openApi.definition;
              break;
            }
          }
        }
      }
    }

    if (!openApiDefinition) {
      result.status = "FAIL";
      result.description = `OpenAPI definition not found.`;
      return result;
    }

    operation = await getOperation(
      openApiDefinition,
      step.openApi.operationId,
      step.openApi.statusCode,
      step.openApi.exampleKey,
      step.openApi.server
    );
    if (!operation) {
      result.status = "FAIL";
      result.description = `Couldn't find operation '${step.operationId}' in OpenAPI definition.`;
      return result;
    }
    log(config, "debug", `Operation: ${JSON.stringify(operation, null, 2)}`);

    // Set request info
    if (
      step.openApi.useExample === "request" ||
      step.openApi.useExample === "both"
    ) {
      step.url = operation.example.url;
      step.method = operation.method;
      if (
        step.requestParams ||
        Object.keys(operation.example.request.parameters).length > 0
      )
        step.requestParams = {
          ...operation.example.request.parameters,
          ...step.requestParams,
        };
      if (
        step.requestHeaders ||
        step.openApi.requestHeaders ||
        Object.keys(operation.example.request.headers).length > 0
      )
        step.requestHeaders = {
          ...operation.example.request.headers,
          ...step.openApi.requestHeaders,
          ...step.requestHeaders,
        };
      if (
        step.requestData ||
        Object.keys(operation.example.request.body).length > 0
      )
        step.requestData = {
          ...operation.example.request.body,
          ...step.requestData,
        };
    }
    // Set response info
    if (
      step.openApi.useExample === "response" ||
      step.openApi.useExample === "both"
    ) {
      if (
        step.responseHeaders ||
        Object.keys(operation.example.response.headers).length > 0
      )
        step.responseHeaders = {
          ...operation.example.response.headers,
          ...step.responseHeaders,
        };
      if (
        step.responseData ||
        Object.keys(operation.example.response.body).length > 0
      )
        step.responseData = {
          ...operation.example.response.body,
          ...step.responseData,
        };
    }
    // Set status code
    if (step.openApi.statusCode) {
      step.statusCodes = step.statusCodes
        ? [step.openApi.statusCode, ...step.statusCodes]
        : [step.openApi.statusCode];
    }
  }

  // Make sure there's a protocol
  if (step.url && !step.url.includes("://")) step.url = "https://" + step.url;

  // Validate step payload
  isValidStep = validate("httpRequest_v2", step);
  if (!isValidStep.valid) {
    result.status = "FAIL";
    result.description = `Invalid step definition: ${isValidStep.errors}`;
    return result;
  }

  const request = {
    url: step.url,
    method: step.method,
    headers: step.requestHeaders,
    params: step.requestParams,
    data: step.requestData,
  };

  // Validate request payload against OpenAPI definition
  if (
    (step.openApi?.validateAgainstSchema === "request" ||
      step.openApi?.validateAgainstSchema === "both") &&
    operation.schemas.request
  ) {
    // Validate request payload against OpenAPI definition
    const ajv = new Ajv({
      strictSchema: false,
      useDefaults: true,
      allErrors: true,
      allowUnionTypes: true,
      coerceTypes: false,
    });
    const validate = ajv.compile(operation.schemas.request);
    const valid = validate(step.requestData);
    if (valid) {
      result.description = ` Request data matched the OpenAPI schema.`;
    } else {
      result.status = "FAIL";
      result.description = ` Request data didn't match the OpenAPI schema. ${JSON.stringify(
        validate.errors,
        null,
        2
      )}`;
      return result;
    }
  }

  let response = {};
  if (!step?.openApi?.mockResponse) {
    // Perform request
    response = await axios(request)
      .then((response) => {
        result.actualResponseData = response.data;
        return response;
      })
      .catch((error) => {
        return { error };
      });
  } else {
    // Mock response
    if (
      JSON.stringify(step.responseData) == "{}" &&
      JSON.stringify(operation.example.response.body) != "{}"
    ) {
      response.data = operation.example.response.body;
    } else {
      response.data = step.responseData;
    }
    result.actualResponseData = response.data;
    response.status = step.statusCodes[0];
    response.headers = step.responseHeaders;
  }

  // If request returned an error
  if (response.error) {
    result.status = "FAIL";
    result.actualResponseData = response.error.response?.data;
    result.description = `Error: ${JSON.stringify(response.error.message)}`;
    return result;
  }

  // Compare status codes
  if (step.statusCodes) {
    if (step.statusCodes.indexOf(response.status) >= 0) {
      result.status = "PASS";
      result.description = `Returned ${response.status}.`;
    } else {
      result.status = "FAIL";
      result.description = `Returned ${
        response.status
      }. Expected one of ${JSON.stringify(step.statusCodes)}`;
    }
  }

  // Validate response payload against OpenAPI definition
  if (
    (step.openApi?.validateAgainstSchema === "response" ||
      step.openApi?.validateAgainstSchema === "both") &&
    operation.schemas.response
  ) {
    // Validate request payload against OpenAPI definition
    const ajv = new Ajv({
      strictSchema: false,
      useDefaults: true,
      allErrors: true,
      allowUnionTypes: true,
      coerceTypes: false,
    });
    const validate = ajv.compile(operation.schemas.response);
    const valid = validate(response.data);
    if (valid) {
      result.description += ` Response data matched the OpenAPI schema.`;
    } else {
      result.status = "FAIL";
      result.description += ` Response data didn't match the OpenAPI schema. ${JSON.stringify(
        validate.errors,
        null,
        2
      )}`;
      return result;
    }
  }

  // Compare response.data and responseData
  if (!step.allowAdditionalFields) {
    // Do a deep comparison
    let dataComparison = objectExistsInObject(response.data, step.responseData);
    if (dataComparison.result.status === "FAIL") {
      result.status = "FAIL";
      result.description += " Response contained unexpected fields.";
      return result;
    }
  }

  if (JSON.stringify(step.responseData) != "{}") {
    let dataComparison = objectExistsInObject(step.responseData, response.data);
    if (dataComparison.result.status === "PASS") {
      if (result.status != "FAIL") result.status = "PASS";
      result.description += ` Expected response data was present in actual response data.`;
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
      result.description += ` Expected response headers were present in actual response headers.`;
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
      // Trim quotes if present
      value = value.replace(/^"(.*)"$/, "$1");
      process.env[variable.name] = value;
      result.description =
        result.description + ` Set '$${variable.name}' environment variable.`;
    } else {
      if (result.status != "FAIL") result.status = "WARNING";
      result.description += ` Couldn't set '${variable.name}' environment variable. The jq filter (${variable.jqFilter}) returned a null result.`;
    }
  }

  // Check if command output is saved to a file
  if (step.savePath) {
    const dir = path.dirname(step.savePath);
    // If `dir` doesn't exist, create it
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Set filePath
    let filePath = step.savePath;
    log(config, "debug", `Saving output to file: ${filePath}`);

    // Check if file already exists
    if (!fs.existsSync(filePath)) {
      // Doesn't exist, save output to file
      fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
      result.description += ` Saved output to file.`;
    } else {
      if (step.overwrite == "false") {
        // File already exists
        result.description += ` Didn't save output. File already exists.`;
      }

      // Read existing file
      const existingFile = fs.readFileSync(filePath, "utf8");

      // Calculate percentage diff between existing file content and command output content, not length
      const percentDiff = calculatePercentageDifference(
        existingFile,
        JSON.stringify(response.data, null, 2)
      );
      log(config, "debug", `Percentage difference: ${percentDiff}%`);

      if (percentDiff > step.maxVariation) {
        if (step.overwrite == "byVariation") {
          // Overwrite file
          fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
        }
        result.status = "FAIL";
        result.description += ` The percentage difference between the existing file content and command output content (${percentDiff}%) is greater than the max accepted variation (${step.maxVariation}%).`;
        return result;
      }

      if (step.overwrite == "true") {
        // Overwrite file
        fs.writeFileSync(filePath, JSON.stringify(response.data, null, 2));
      }
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
    } else if (expected[key] !== actual[key]) {
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
