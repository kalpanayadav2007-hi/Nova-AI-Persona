import { Request, Response } from "express";
import { randomUUID } from "crypto";
import db from "../database/db";
import { startScheduler } from "../scheduler/scheduler";

export const initializeAgent = (req: Request, res: Response) => {
  const { persona } = req.body;

  if (!persona?.name || !persona?.domain) {
    return res.status(400).json({
      error: "persona.name and persona.domain are required",
    });
  }

  const agentId = randomUUID();

  const stmt = db.prepare(`
    INSERT INTO agents (id, name, domain, initializedAt)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(
    agentId,
    persona.name,
    persona.domain,
    new Date().toISOString()
  );

  // Start the autonomous scheduler after the agent is created
  startScheduler(agentId);

  return res.status(200).json({
    agentId,
  });
};

export const getFeed = (req: Request, res: Response) => {
  const { agentId } = req.query;

  if (!agentId) {
    return res.status(400).json({
      error: "agentId is required",
    });
  }

  const stmt = db.prepare(`
    SELECT *
    FROM posts
    WHERE agentId = ?
    ORDER BY createdAt DESC
  `);

  const posts = stmt.all(agentId);

  return res.status(200).json({
    posts,
  });
};