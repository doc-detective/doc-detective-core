/**
 * Dereferences an OpenAPI definition.
 *
 * @param {Object} definition - The OpenAPI definition to be dereferenced.
 * @returns {Promise<Object>} - The dereferenced OpenAPI definition.
 */
async function dereferenceOpenApiDefinition(definition = {}) {
  // Error handling
  if (!definition) {
    throw new Error("OpenAPI definition is required.");
  }

  const parser = require("@apidevtools/json-schema-ref-parser");
  const dereferencedDefinition = await parser.dereference(definition);
  return dereferencedDefinition;
}

/**
 * Retrieves the operation object from the OpenAPI definition based on the provided operationId.
 *
 * @param {object} definition - The OpenAPI definition object.
 * @param {string} operationId - The operationId to search for.
 * @returns {object|null} - The operation, path, and method if found, otherwise null.
 */
function getOperation(
  definition = {},
  operationId = "",
  responseCode = "",
  exampleKey = ""
) {
  // Error handling
  if (!definition) {
    throw new Error("OpenAPI definition is required.");
  }
  if (!operationId) {
    throw new Error("OperationId is required.");
  }
  // Search for the operationId in the OpenAPI definition
  for (const path in definition.paths) {
    for (const method in definition.paths[path]) {
      if (definition.paths[path][method].operationId === operationId) {
        const operation = definition.paths[path][method];
        const server = definition.servers[0].url;
        const example = compileExample(
          operation,
          server + path,
          responseCode,
          exampleKey
        );
        const schemas = getSchemas(operation, responseCode);
        return { path, method, definition: operation, schemas, example };
      }
    }
  }
  return null;
}

function getSchemas(definition = {}, responseCode = "") {
  const schemas = {};

  // Get request schema for operation
  if (definition.requestBody) {
    schemas.request =
      definition.requestBody.content[Object.keys(definition.requestBody.content)[0]].schema;
  }
  if (!responseCode) {
    responseCode = Object.keys(definition.responses)[0];
  }
  schemas.response =
    definition.responses[responseCode].content[
      Object.keys(definition.responses[responseCode].content)[0]
    ].schema;

  return schemas;
}

/**
 * Compiles an example object based on the provided operation, path, and example key.
 *
 * @param {Object} operation - The operation object.
 * @param {string} path - The path string.
 * @param {string} exampleKey - The example key string.
 * @returns {Object} - The compiled example object.
 * @throws {Error} - If operation or path is not provided.
 */
function compileExample(
  operation = {},
  path = "",
  responseCode = "",
  exampleKey = ""
) {
  // Error handling
  if (!operation) {
    throw new Error("Operation is required.");
  }
  if (!path) {
    throw new Error("Path is required.");
  }

  // Setup
  const example = { url: path };

  // Path parameters
  const pathParameters = getExampleParameters(operation, "path", exampleKey);
  pathParameters.forEach((param) => {
    example.url = example.url.replace(`{${param.key}}`, param.value);
  });

  // Query parameters
  const queryParameters = getExampleParameters(operation, "query", exampleKey);
  if (queryParameters.length > 0) example.parameters = {};
  queryParameters.forEach((param) => {
    example.parameters[param.key] = param.value;
  });

  // Headers
  const headerParameters = getExampleParameters(
    operation,
    "header",
    exampleKey
  );
  if (headerParameters.length > 0) example.headers = {};
  headerParameters.forEach((param) => {
    example.headers[param.key] = param.value;
  });

  // Request body
  if (operation.requestBody) {
    const requestBody = getExample(operation.requestBody, exampleKey);
    if (requestBody) {
      example.request = requestBody;
    }
  }

  // Response body
  if (!responseCode) {
    responseCode = Object.keys(operation.responses)[0];
  }
  console.log(responseCode);
  const response = operation.responses[responseCode];
  const responseBody = getExample(response, exampleKey);
  if (responseBody) {
    example.response = responseBody;
  }

  // console.log(JSON.stringify(example, null, 2));
  return example;
}

// Return array of query parameters for the example
/**
 * Retrieves example parameters based on the given operation, type, and example key.
 *
 * @param {object} operation - The operation object.
 * @param {string} [type=""] - The type of parameter to retrieve.
 * @param {string} [exampleKey=""] - The example key to use.
 * @returns {Array} - An array of example parameters.
 * @throws {Error} - If the operation is not provided.
 */
function getExampleParameters(operation = {}, type = "", exampleKey = "") {
  const params = [];

  // Error handling
  if (!operation) {
    throw new Error("Operation is required.");
  }
  if (!operation.parameters) return params;

  // Find all query parameters
  for (const parameter of operation.parameters) {
    if (parameter.in === type) {
      const value = getExample(parameter, exampleKey);
      if (value) {
        params.push({ key: parameter.name, value });
      }
    }
  }

  return params;
}

/**
 * Retrieves an example value based on the given definition and example key.
 *
 * @param {object} definition - The definition object.
 * @param {string} exampleKey - The key of the example to retrieve.
 * @returns {object|null} - The example value.
 * @throws {Error} - If the definition is not provided.
 */
function getExample(definition = {}, exampleKey = "") {
  // Debug
  // console.log({definition, exampleKey});

  // Setup
  let example;

  // Error handling
  if (!definition) {
    throw new Error("Definition is required.");
  }

  if (
    definition.examples &&
    exampleKey &&
    typeof definition.examples[exampleKey] !== "undefined"
  ) {
    // If the definition has an `examples` property, exampleKey is specified, and the exampleKey exists in the examples object, use that example.
    example = definition.examples[exampleKey];
  } else if (typeof definition.example !== "undefined") {
    // If the definition has an `example` property, use that example.
    example = definition.example;
  } else {
    // If the definition has no examples, generate an example based on the definition/properties.
    // Find the next `schema` child property in the definition, regardless of depth
    let schema;
    if (definition.schema) {
      // Parameter pattern
      schema = definition.schema;
    } else if (definition.properties) {
      // Object pattern
      schema = definition;
    } else if (definition.items) {
      // Array pattern
      schema = definition;
    } else if (definition.content) {
      // Request/response body pattern
      for (const key in definition.content) {
        if (definition.content[key].schema) {
          schema = definition.content[key].schema;
          break;
        }
      }
    } else {
      return null;
    }

    if (schema.type === "object") {
      example = generateObjectExample(schema, exampleKey);
    } else if (schema.type === "array") {
      example = generateArrayExample(schema.items, exampleKey);
    } else {
      example = getExample(schema, exampleKey);
    }
  }

  // console.log(example);
  return example;
}

/**
 * Generates an object example based on the provided schema and example key.
 *
 * @param {object} schema - The schema object.
 * @param {string} exampleKey - The example key.
 * @returns {object} - The generated object example.
 */
function generateObjectExample(schema = {}, exampleKey = "") {
  const example = {};
  for (const property in schema.properties) {
    const objectExample = getExample(schema.properties[property], exampleKey);
    if (objectExample) example[property] = objectExample;
  }
  return example;
}

/**
 * Generates an array example based on the provided items and example key.
 *
 * @param {Object} items - The items object.
 * @param {string} exampleKey - The example key.
 * @returns {Array} - The generated array example.
 */
function generateArrayExample(items = {}, exampleKey = "") {
  // Debug
  // console.log({ items, exampleKey });

  const example = [];
  const itemExample = getExample(items, exampleKey);
  if (itemExample) example.push(itemExample);

  // Debug
  // console.log(example);
  return example;
}

module.exports = { getOperation, dereferenceOpenApiDefinition };

// (async () => {
//   const apiDefinition = require("C:\\Users\\hawkeyexl\\Documents\\Workspaces\\doc-detective-core\\dev\\reqres.openapi.json");
//   const definition = await dereferenceOpenApiDefinition(apiDefinition);
//   const operationId = "addUser";
//   const operation = getOperation(definition, operationId);
//   console.log(JSON.stringify(operation, null, 2));
// })();

// const paramDefinition = {
//   name: "page",
//   in: "query",
//   description: "Select the portition of record you want back",
//   required: false,
//   // examples: {
//   //   default: 3,
//   // },
//   example: 4,
//   schema: {
//     type: "integer",
//     example: 1,
//   },
// };

// const requestBody = {
//   description: "Update an existent pet in the store",
//   content: {
//     "application/json": {
//       schema: {
//         type: "object",
//         properties: {
//           name: {
//             type: "string",
//             examples: {
//               default: "morpheus",
//             },
//           },
//           job: {
//             type: "string",
//             example: "leader",
//           },
//           nicknames: {
//             type: "array",
//             examples: {
//               default: ["mor", "pheus"],
//               test: ["foo", "bar"],
//             },
//             items: {
//               type: "string",
//               example: "neo",
//             },
//           },
//           age: {
//             type: "object",
//             properties: {
//               years: {
//                 type: "integer",
//                 example: 35,
//               },
//               months: {
//                 type: "integer",
//                 example: 0,
//               },
//             },
//           },
//         },
//       },
//     },
//   },
//   required: true,
// };

// console.log(getExample(requestBody, "test"));

// console.log(getExampleQueryParameters(operation.definition));
