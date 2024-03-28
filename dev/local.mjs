import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, LlamaJsonSchemaGrammar, defineChatSessionFunction} from "node-llama-cpp";
import { schemas } from "doc-detective-common";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schema = {
    type: "object",
    properties: {
        steps: schemas.test_v2.properties.steps
    }
};

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "functionary-small-v2.2.q4_0.gguf"),
    gpuLayers: 30
});
const context = await model.createContext({
    contextSize: Math.min(4096, model.trainContextSize)
});
const grammar = new LlamaJsonSchemaGrammar(llama, schema);
const functions = {
    getDate: defineChatSessionFunction({
        description: "Retrieve the current date",
        handler() {
            return new Date().toLocaleDateString();
        }
    }),
    createTest: defineChatSessionFunction({
        description: "Create a Doc Detective test to validate procedure content.",
        params: schema,
        handler(params) {
            return params;
        }
    })
};
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "Evaluate the following procedure string, identify each action that the string instructs the user to complete, and adapt those actions to steps in a Doc Detective test: Go to [Google](www.google.com). Type 'American shorthair kittens', then press Enter.";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {grammar});
console.log(a1);