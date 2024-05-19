const { ChatOllama } = require("@langchain/community/chat_models/ollama");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are an expert translator. Format all responses as JSON objects with two keys: "original" and "translated".`,
  ],
  ["human", `Translate "{input}" into {language}.`],
]);

main();

async function main() {
  const model = new ChatOllama({
    baseUrl: "http://localhost:11434", // Default value
    model: "phi3", // Default value
    format: "json",
  });

  const chain = prompt.pipe(model);

  //   const stream = await model
  //     .pipe(new StringOutputParser())
  //     .stream(`Translate "I love programming" into German.`);

  const result = await chain.invoke({
    input: "I love programming",
    language: "German",
  });

  console.log(result);
}
