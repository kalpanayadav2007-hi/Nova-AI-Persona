import { GoogleGenAI } from "@google/genai";
import { config } from "../config/env";

if (!config.geminiApiKey) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({
  apiKey: config.geminiApiKey,
});

export async function askGemini(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "";
}