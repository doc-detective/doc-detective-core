// TODO: Dereference the OpenAPI definition.
async function dereferenceDefinition() {}

/**
 * Retrieves the operation object from the OpenAPI definition based on the provided operationId.
 *
 * @param {object} definition - The OpenAPI definition object.
 * @param {string} operationId - The operationId to search for.
 * @returns {object|null} - The operation, path, and method if found, otherwise null.
 */
function getOperation(definition = {}, operationId = "", exampleKey = "") {
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
        const example = compileExample(operation, path, exampleKey);
        return { path, method, definition: operation, example };
      }
    }
  }
  return null;
}

// Given an operation object, retrieves the examples for the parameters, request body, and responses. Returns an array of examples.
// If multiple examples are provided, each examples[key] value is complied individually and returned as an array item.
// If a parameter or object has an `example` property, that value is used for all examples[key] values.
function compileExample(operation = {}, path = "", exampleKey = "") {
  // Error handling
  if (!operation) {
    throw new Error("Operation is required.");
  }
  if (!path) {
    throw new Error("Path is required.");
  }

  // Setup
  const example = {url: path, headers: [], request: {}, response: {}};
  
  // Path parameters
  const pathParameters = getExampleParameters(operation, "path", exampleKey);
  pathParameters.forEach((param) => { 
    example.url = example.url.replace(`{${param.key}}`, param.value);
  });

  // Query parameters
  const queryParameters = getExampleParameters(operation, "query", exampleKey);
  queryParameters.forEach((param) => {
    example.url += `${example.url.includes("?") ? "&" : "?"}${param.key}=${param.value}`;
  });

  console.log(example);
  return example;
}

// Return array of query parameters for the example
function getExampleParameters(operation = {}, type = "", exampleKey = "") {
  const params = [];

  // Error handling
  if (!operation) {
    throw new Error("Operation is required.");
  }
  if (!operation.parameters) return queryParams;

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


// Given a string with parameters, replaces the parameters with the provided values.
function compileString(string = "", parameters = []) {
  for (const parameter of parameters) {
    string = string.replace(`{${parameter.key}}`, parameter.value);
  }
  return string;
}

// Given a parameter or object definition or schema, returns an example object.
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

function generateObjectExample(schema = {}, exampleKey = "") {
  const example = {};
  for (const property in schema.properties) {
    const objectExample = getExample(schema.properties[property], exampleKey);
    if (objectExample) example[property] = objectExample;
  }
  return example;
}

function generateArrayExample(items = {}, exampleKey = "") {
  // Debug
  console.log({ items, exampleKey });

  const example = [];
  const itemExample = getExample(items, exampleKey);
  if (itemExample) example.push(itemExample);

  // Debug
  console.log(example);
  return example;
}

module.exports = { getOperation };

const apiDefinition = require("C:\\Users\\hawkeyexl\\Documents\\Workspaces\\doc-detective-core\\dev\\reqres_deref.openapi.json");
const operationId = "getUsers";
const operation = getOperation(apiDefinition, operationId);
console.log(operation);

const paramDefinition = {
  name: "page",
  in: "query",
  description: "Select the portition of record you want back",
  required: false,
  // examples: {
  //   default: 3,
  // },
  example: 4,
  schema: {
    type: "integer",
    example: 1,
  },
};

const requestBody = {
  description: "Update an existent pet in the store",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            examples: {
              default: "morpheus",
            },
          },
          job: {
            type: "string",
            example: "leader",
          },
          nicknames: {
            type: "array",
            examples: {
              default: ["mor", "pheus"],
              test: ["foo", "bar"],
            },
            items: {
              type: "string",
              example: "neo",
            },
          },
          age: {
            type: "object",
            properties: {
              years: {
                type: "integer",
                example: 35,
              },
              months: {
                type: "integer",
                example: 0,
              },
            },
          },
        },
      },
    },
  },
  required: true,
};

// console.log(getExample(requestBody, "test"));

// console.log(getExampleQueryParameters(operation.definition));
