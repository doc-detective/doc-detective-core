const {
  OllamaFunctions,
} = require("@langchain/community/experimental/chat_models/ollama_functions");
const { HumanMessage } = require("@langchain/core/messages");
const { schemas } = require("doc-detective-common");

main(
  "Go to [Google](www.google.com). In the search bar, type 'American shorthair kittens', then press Enter."
);

async function main(string) {
  const model = new OllamaFunctions({
    temperature: 0.1,
    model: "llama3",
  }).bind({
    functions: [
      {
        name: "doc-detective",
        description: "A Doc Detective test to validate procedure content.",
        parameters: { type: "object", properties: schemas.test_v2.properties },
      },
    ],
    // You can set the `function_call` arg to force the model to use a function
    // function_call: {
    //   name: "doc-detective",
    // },
  });

  const response = await model.invoke([
    new HumanMessage({
      content: `Evaluate the following portion of a procedure, identify each instruction, and adapt each instruction to a step in a Doc Detective test:\n${string}`,
    }),
  ]);

  console.log(response);

  /*
  AIMessage {
    content: '',
    additional_kwargs: {
      function_call: {
        name: 'get_current_weather',
        arguments: '{"location":"Boston, MA","unit":"fahrenheit"}'
      }
    }
  }
*/
}
