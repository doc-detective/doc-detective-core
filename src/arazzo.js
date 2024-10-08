const { uuid } = require("uuidv4");

/**
 * Translates an Arazzo description into a Doc Detective test specification
 * @param {Object} arazzoDescription - The Arazzo description object
 * @returns {Object} - The Doc Detective test specification object
 */
function translateArazzoToDocDetective(arazzoDescription) {
  // Initialize the Doc Detective test specification
  const docDetectiveSpec = {
    id: arazzoDescription.info.title || `${uuid()}`,
    description:
      arazzoDescription.info.description || arazzoDescription.info.summary,
    tests: [],
    openApi: [],
  };

  arazzoDescription.sourceDescriptions.forEach((source) => {
    // Translate OpenAPI definitions to Doc Detective format
    if (source.type === "openapi") {
      const openApiDefinition = {
        name: source.name,
        descriptionPath: source.url,
      };
      docDetectiveSpec.openApi.push(openApiDefinition);
    }
  });

  // Iterate through each workflow in the Arazzo description
  arazzoDescription.workflows.forEach((workflow) => {
    const test = {
      id: workflow.workflowId || `${uuid()}`,
      description: workflow.description || workflow.summary,
      steps: [],
    };

    // Translate each step in the workflow to a Doc Detective step
    workflow.steps.forEach((step) => {
      const docDetectiveStep = translateStep(step);
      if (docDetectiveStep) {
        test.steps.push(docDetectiveStep);
      }
    });

    docDetectiveSpec.tests.push(test);
  });

  return docDetectiveSpec;
}

/**
 * Translates an Arazzo step to a Doc Detective step
 * @param {Object} arazzoStep - The Arazzo step object
 * @returns {Object|null} - The Doc Detective step object or null if not supported
 */
function translateStep(arazzoStep) {
  // Handle different types of steps based on the action
  if (arazzoStep.operationId) {
    // Translate API operation steps
    return translateApiStep(arazzoStep);
  } else if (arazzoStep.operationPath) {
    // Handle operation path references (not directly supported in Doc Detective)
    console.warn(
      `Operation path references are not directly supported in Doc Detective: ${arazzoStep.operationPath}`
    );
    return null;
  } else if (arazzoStep.workflowId) {
    // Handle workflow references (not directly supported in Doc Detective)
    console.warn(
      `Workflow references are not directly supported in Doc Detective: ${arazzoStep.workflowId}`
    );
    return null;
  }

  // Handle unsupported step types
  console.warn(`Unsupported step type: ${JSON.stringify(arazzoStep)}`);
  return null;
}

/**
 * Translates an Arazzo API step to a Doc Detective step
 * @param {Object} arazzoStep - The Arazzo API step object
 * @returns {Object} - The Doc Detective step object
 */
function translateApiStep(arazzoStep) {
  const docDetectiveStep = {
    action: "httpRequest",
    openApi: { operationId: arazzoStep.operationId },
  };

  // Add parameters
  if (arazzoStep.parameters) {
    docDetectiveStep.requestParams = {};
    arazzoStep.parameters.forEach((param) => {
      if (param.in === "query") {
        docDetectiveStep.requestParams[param.name] = param.value;
      } else if (param.in === "header") {
        if (!docDetectiveStep.requestHeaders)
          docDetectiveStep.requestHeaders = {};
        docDetectiveStep.requestHeaders[param.name] = param.value;
      }
      // Note: path parameters would require modifying the URL, which is not handled in this simple translation
    });
  }

  // Add request body if present
  if (arazzoStep.requestBody) {
    docDetectiveStep.requestData = arazzoStep.requestBody.payload;
  }

  // Translate success criteria to response validation
  if (arazzoStep.successCriteria) {
    docDetectiveStep.responseData = {};
    arazzoStep.successCriteria.forEach((criterion) => {
      if (criterion.condition.startsWith("$statusCode")) {
        docDetectiveStep.statusCodes = [
          parseInt(criterion.condition.split("==")[1].trim()),
        ];
      } else if (criterion.context === "$response.body") {
        // This is a simplification; actual JSONPath translation would be more complex
        docDetectiveStep.responseData[criterion.condition] = true;
      }
    });
  }

  return docDetectiveStep;
}

/**
 * Determines the HTTP method for an Arazzo step
 * @param {Object} arazzoStep - The Arazzo step object
 * @returns {string} - The HTTP method (defaulting to 'get')
 */
function determineHttpMethod(arazzoStep) {
  // This is a simplification; in a real implementation, you'd need to look up the method
  // from the referenced OpenAPI specification or derive it from the operationId
  return "get";
}

// Example usage:
// const arazzoDescription = { /* Your Arazzo description object */ };
// const docDetectiveSpec = translateArazzoToDocDetective(arazzoDescription);
// console.log(JSON.stringify(docDetectiveSpec, null, 2));
