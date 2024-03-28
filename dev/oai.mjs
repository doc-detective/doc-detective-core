import OpenAI from "openai";
import { schemas } from "doc-detective-common";

const openai = new OpenAI({
  apiKey: process.env['OPENAI_API_KEY'], // This is the default and can be omitted
});

async function main() {
  const chatCompletion = await openai.chat.completions.create({
    messages: [
      {
        role: "user",
        content:
          "Evaluate the following string, which is part of a procedure, and identify each action that the string instructs the user to complete. Adapt the following string to a Doc Detective test: Go to [Google](www.google.com). Type 'American shorthair kittens', then press Enter.",
      },
    ],
    model: "gpt-3.5-turbo",
    functions: [
      {
        name: "test",
        description: "A Doc Detective test to validate procedure content.",
        parameters: { type: "object", properties: schemas.test_v2.properties },
      },
    ],
  });
  console.log(chatCompletion.choices[0].message.function_call.arguments);
  console.log(JSON.parse(chatCompletion.choices[0].message.function_call.arguments));
}

main();
