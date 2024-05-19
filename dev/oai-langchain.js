const { ChatOpenAI } = require("@langchain/openai");
const { ToolMessage } = require("@langchain/core/messages");
const { schemas } = require("doc-detective-common");

main("Go to [Google](www.google.com). In the search bar, type 'American shorthair kittens', then press Enter.");

async function main(string) {
// Bind function to the model as a tool
const chat = new ChatOpenAI({
  model: "gpt-4-turbo",
  temperature: 0.1,
  maxTokens: 128,
  apiKey: process.env.OPENAI_API_KEY,
}).bind({
  tools: [
    {
      type: "function",
      function: {
        name: "make_doc_detective_test",
        description: "A Doc Detective test to validate procedure content.",
        parameters: { type: "object", properties: schemas.spec_v2.properties },
      },
    },
  ],
  tool_choice: "auto",
});

// Ask initial question that requires multiple tool calls
const res = await chat.invoke([
  ["human", `Evaluate the following portion of a procedure, identify each instruction, and adapt each instruction to a step in a Doc Detective test:\n${string}`],
]);
console.log(JSON.stringify(JSON.parse(res.additional_kwargs.tool_calls[0].function.arguments), null, 2));
/*
  [
    {
      id: 'call_IiOsjIZLWvnzSh8iI63GieUB',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location": "San Francisco", "unit": "celsius"}'
      }
    },
    {
      id: 'call_blQ3Oz28zSfvS6Bj6FPEUGA1',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location": "Tokyo", "unit": "celsius"}'
      }
    },
    {
      id: 'call_Kpa7FaGr3F1xziG8C6cDffsg',
      type: 'function',
      function: {
        name: 'get_current_weather',
        arguments: '{"location": "Paris", "unit": "celsius"}'
      }
    }
  ]
*/

// // Format the results from calling the tool calls back to OpenAI as ToolMessages
// const toolMessages = res.additional_kwargs.tool_calls?.map((toolCall) => {
//   const toolCallResult = getCurrentWeather(
//     JSON.parse(toolCall.function.arguments).location
//   );
//   return new ToolMessage({
//     tool_call_id: toolCall.id,
//     name: toolCall.function.name,
//     content: toolCallResult,
//   });
// });

// // Send the results back as the next step in the conversation
// const finalResponse = await chat.invoke([
//   ["human", "What's the weather like in San Francisco, Tokyo, and Paris?"],
//   res,
//   ...(toolMessages ?? []),
// ]);

// console.log(finalResponse);
// /*
//   AIMessage {
//     content: 'The current weather in:\n' +
//       '- San Francisco is 72°F\n' +
//       '- Tokyo is 10°C\n' +
//       '- Paris is 22°C',
//     additional_kwargs: { function_call: undefined, tool_calls: undefined }
//   }
// */
}