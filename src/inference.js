const { ChatOpenAI } = require("@langchain/openai");
const { schemas, validate } = require("doc-detective-common");
const { log } = require("./utils");

exports.inferSpec = inferSpec;

// inferSpec(
//   {
//     logLevel: "debug",
//     integrations: {
//       openai: {
//         apiKey: process.env.OPENAI_API_KEY,
//       },
//     },
//   },
//   "Go to [Google](www.google.com). In the search bar, type 'American shorthair kittens', then press Enter."
// );

// Create an LLM instance
function createLlm(config, model) {
  switch (model) {
    case "gpt-4-turbo":
      log(config, "debug", "Using gpt-4-turbo.");
      return new ChatOpenAI({
        model: "gpt-4-turbo",
        temperature: 0.1,
        maxTokens: 128,
        apiKey: config.integrations.openai.apiKey || process.env.OPENAI_API_KEY,
      });
    case "gpt-3.5-turbo":
    default:
      log(config, "debug", "Using gpt-3.5-turbo.");
      return new ChatOpenAI({
        model: "gpt-3.5-turbo",
        temperature: 0.1,
        maxTokens: 128,
        apiKey: config.integrations.openai.apiKey || process.env.OPENAI_API_KEY,
      });
  }
}

// Infer a Doc Detective test from a string
async function inferSpec(config, string) {
  // Bind function to the model as a tool
  const chat = createLlm(config, "gpt-4-turbo").bind({
    tools: [
      {
        type: "function",
        function: {
          name: "make_doc_detective_test",
          description: "A Doc Detective test to validate procedure content.",
          parameters: {
            type: "object",
            properties: schemas.spec_v2.properties,
          },
        },
      },
    ],
    tool_choice: "auto",
  });

  const prompt = [
    [
      "human",
      `Evaluate the following portion of a procedure, identify each instruction, and adapt each instruction to a step in a Doc Detective test:\n${string}`,
    ],
  ];

  // Ask initial question that requires multiple tool calls
  const maxAttempts = 5;
  for (let i = 0; i < maxAttempts; i++) {
    log(
      config,
      "debug",
      `Inference attempt ${i + 1} of ${maxAttempts}: ${string}`
    );
    if (i >= maxAttempts - 1) {
      log(config, "error", "Failed to infer spec.");
      return null;
    }
    let res = await chat.invoke(prompt);
    let spec = JSON.parse(
      res.additional_kwargs.tool_calls[0].function.arguments
    );
    let validation = validate("spec_v2", spec);
    if (!validation.valid) {
      log(config, "debug", "Validation errors:");
      log(config, "debug", validation.errors);
      prompt.push([
        "human", `The last inferred spec returned the following validation errors:\n${validation.errors}`
      ])
    }
    if (validation.valid) {
      log(config, "info", "Inferred spec.");
      log(config, "debug", "Inferred spec:");
      log(config, "debug", spec);
      return spec;
    }
  }
}
