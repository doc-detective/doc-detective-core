import OpenAI from "openai";
import { schemas } from "doc-detective-common";

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function main(string) {
  const chatCompletion = await openai.chat.completions.create({
    temperature: 0,
    messages: [
      {
        role: "user",
        content:
          `Evaluate the following portion of a procedure, identify each instruction, and adapt each instruction to a step in a Doc Detective test:\n${string}`,
      },
    ],
    model: "gpt-4-turbo",
    functions: [
      {
        name: "test",
        description: "A Doc Detective test to validate procedure content.",
        parameters: { type: "object", properties: schemas.spec_v2.properties },
      },
    ],
  });
  console.log(JSON.parse(chatCompletion.choices[0].message.function_call.arguments));
  console.log(JSON.stringify(JSON.parse(chatCompletion.choices[0].message.function_call.arguments), null, 2));
}

main("Go to [Google](www.google.com). In the search bar, type 'American shorthair kittens', then press Enter.");
