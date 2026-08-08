import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  dbPath: process.env.DB_PATH || "./storage/agent.db",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
};