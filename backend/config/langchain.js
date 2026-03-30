import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const createLLM = () => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        throw new Error("GOOGLE_API_KEY is not defined in environment variables");
    }

    return new ChatGoogleGenerativeAI({
        apiKey: apiKey,
        model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview",
        temperature: 0,
        maxOutputTokens: 2048,
    });
};

export default { createLLM };
