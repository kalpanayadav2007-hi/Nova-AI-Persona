// src/server.ts

import express from "express";
import cors from "cors";
import dotenv from "dotenv";


import agentRoutes from "./routes/agentRoutes";

import db from "./database/db";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Test API
app.get("/", (req, res) => {
  res.json({
    message: "Autonomous AI Persona API is running 🚀"
  });
});

// Routes
app.use("/api/agent", agentRoutes);

// Check database connection
db;

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});