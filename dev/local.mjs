import {fileURLToPath} from "url";
import path from "path";
import {getLlama, LlamaChatSession, defineChatSessionFunction} from "node-llama-cpp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const llama = await getLlama();
const model = await llama.loadModel({
    modelPath: path.join(__dirname, "functionary-small-v2.2.q4_0.gguf")
});
const context = await model.createContext({
    contextSize: Math.min(4096, model.trainContextSize)
});
const functions = {
    getDate: defineChatSessionFunction({
        description: "Retrieve the current date",
        handler() {
            return new Date().toLocaleDateString();
        }
    }),
    getNthWord: defineChatSessionFunction({
        description: "Get an n-th word",
        params: {
            type: "object",
            properties: {
                n: {
                    enum: [1, 2, 3, 4]
                }
            }
        },
        handler(params) {
            return ["very", "secret", "this", "hello"][params.n - 1];
        }
    })
};
const session = new LlamaChatSession({
    contextSequence: context.getSequence()
});


const q1 = "What is the second word?";
console.log("User: " + q1);

const a1 = await session.prompt(q1, {functions});
console.log("AI: " + a1);


const q2 = "What is the date? Also tell me the word I previously asked for";
console.log("User: " + q2);

const a2 = await session.prompt(q2, {functions});
console.log("AI: " + a2);