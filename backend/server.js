const express = require("express");
const cors = require("cors");
const app = express();

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

const dotenv = require("dotenv");
const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

dotenv.config();



const PORT = Number(process.env.PORT) || 3000;

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY || "";

const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.6-flash";



// ==================================================
// CORS
// ==================================================







const ALLOWED_ORIGIN =
  "https://nova-ai-persona-tawny.vercel.app";

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === ALLOWED_ORIGIN || origin === "http://localhost:5173" || origin === "http://127.0.0.1:5173") {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Vary",
    "Origin"
  );

  // IMPORTANT:
  // Handle browser preflight requests ourselves.
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json());





  


// ==================================================
// GEMINI QUOTA PROTECTION
// ==================================================

let geminiCooldownUntil = 0;

function isGeminiCoolingDown() {
  return Date.now() < geminiCooldownUntil;
}

function setGeminiCooldown(seconds = 60) {
  geminiCooldownUntil =
    Date.now() + Math.max(10, seconds) * 1000;
}

function getCooldownSeconds() {
  return Math.max(
    0,
    Math.ceil(
      (geminiCooldownUntil - Date.now()) / 1000
    )
  );
}

// ==================================================
// SQLITE DATABASE
// ==================================================

const dbPath =
  process.env.DB_PATH || "./storage/agent.db";

const absoluteDbPath = path.resolve(
  __dirname,
  dbPath
);

const dbDirectory =
  path.dirname(absoluteDbPath);

if (!fs.existsSync(dbDirectory)) {
  fs.mkdirSync(dbDirectory, {
    recursive: true,
  });
}

const db = new Database(absoluteDbPath);

console.log("SQLite database connected.");
console.log("Database:", absoluteDbPath);

// ==================================================
// DATABASE TABLES
// ==================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_run TEXT
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    score INTEGER DEFAULT 0,
    rationale TEXT,
    why_selected TEXT,
    why_relevant_now TEXT,
    sources TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
  );
`);

console.log("SQLite tables ready.");

// ==================================================
// HEALTH
// ==================================================

app.get("/", (req, res) => {
  res.json({
    success: true,
    message:
      "Autonomous AI Persona API is running",
    database: "SQLite",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,

    agent: "Nova",

    status: "online",

    database: "SQLite",

    geminiConfigured:
      Boolean(GEMINI_API_KEY),

    geminiModel:
      GEMINI_MODEL,

    geminiCoolingDown:
      isGeminiCoolingDown(),

    geminiCooldownSeconds:
      getCooldownSeconds(),

    fallbackEnabled: true,

    timestamp:
      new Date().toISOString(),
  });
});

// ==================================================
// GEMINI
// ==================================================

async function askGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is missing."
    );
  }

  if (isGeminiCoolingDown()) {
    throw new Error(
      `Gemini is temporarily paused after a quota/rate-limit error. Retry in ${getCooldownSeconds()} seconds.`
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(
      GEMINI_API_KEY
    )}`;

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],

      generationConfig: {
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
      },
    }),
  });

  const data =
    await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `Gemini API returned ${response.status}`;

    const lower =
      message.toLowerCase();

    const quotaError =
      response.status === 429 ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("resource exhausted") ||
      lower.includes("too many requests");

    if (quotaError) {
      let retrySeconds = 60;

      const retryInfo =
        Array.isArray(
          data?.error?.details
        )
          ? data.error.details.find(
              (detail) =>
                String(
                  detail?.["@type"] || ""
                ).includes("RetryInfo")
            )
          : null;

      if (retryInfo?.retryDelay) {
        const parsed =
          parseInt(
            String(
              retryInfo.retryDelay
            ).replace("s", ""),
            10
          );

        if (
          Number.isFinite(parsed) &&
          parsed > 0
        ) {
          retrySeconds = parsed;
        }
      }

      setGeminiCooldown(
        Math.min(
          Math.max(
            retrySeconds,
            60
          ),
          600
        )
      );
    }

    throw new Error(message);
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map(
        (part) =>
          part?.text || ""
      )
      .join("")
      .trim() || "";

  if (!text) {
    throw new Error(
      "Gemini returned an empty response."
    );
  }

  return text;
}

// ==================================================
// PARSE GEMINI JSON
// ==================================================

function parseGeminiJson(text) {
  let cleaned =
    String(text || "").trim();

  cleaned = cleaned
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    // Continue to extraction
  }

  const firstBrace =
    cleaned.indexOf("{");

  const lastBrace =
    cleaned.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    const possibleJson =
      cleaned.slice(
        firstBrace,
        lastBrace + 1
      );

    try {
      return JSON.parse(possibleJson);
    } catch (error) {
      // Continue
    }
  }

  throw new Error(
    "Gemini returned invalid JSON."
  );
}

// ==================================================
// LOCAL NOVA FALLBACK
// ==================================================

function getFallbackTopic(agent) {
  const topics = [
    {
      title:
        "AI agents are moving toward autonomous workflows",

      summary:
        "Modern AI agents are increasingly capable of discovering information, evaluating options, and completing multi-step workflows with less human intervention.",

      score: 92,

      whySelected:
        "Nova selected this topic because autonomous workflows are a major direction in AI engineering.",

      whyRelevantNow:
        "AI agents are rapidly moving from simple chat interfaces toward systems that can plan and execute tasks.",
    },

    {
      title:
        "AI memory is becoming a core agent capability",

      summary:
        "Persistent memory allows AI agents to remember previous decisions, reduce repetition, and provide more consistent interactions over time.",

      score: 89,

      whySelected:
        "Nova selected this topic because memory is an important capability for persistent AI agents.",

      whyRelevantNow:
        "Long-running AI agents increasingly need memory to maintain context across multiple tasks.",
    },

    {
      title:
        "Small AI models are becoming more capable",

      summary:
        "Smaller language models are becoming increasingly useful for specialized and local AI applications because of improvements in efficiency and capability.",

      score: 86,

      whySelected:
        "Nova selected this topic because efficient models can make AI applications cheaper and easier to deploy.",

      whyRelevantNow:
        "Developers are increasingly looking for efficient AI models that reduce infrastructure and inference costs.",
    },

    {
      title:
        "AI systems are becoming more tool-aware",

      summary:
        "Modern AI agents increasingly combine language models with APIs, databases, search systems, and execution environments.",

      score: 88,

      whySelected:
        "Nova selected this topic because tool use is fundamental to building useful autonomous agents.",

      whyRelevantNow:
        "AI systems are increasingly being designed as tool-using agents rather than standalone chatbots.",
    },
  ];

  const existingTitles =
    db
      .prepare(`
        SELECT title
        FROM posts
        WHERE agent_id = ?
      `)
      .all(agent.id)
      .map(
        (row) => row.title
      );

  const available =
    topics.filter(
      (topic) =>
        !existingTitles.includes(
          topic.title
        )
    );

  if (!available.length) {
    return topics[
      Math.floor(
        Math.random() *
          topics.length
      )
    ];
  }

  return available[
    Math.floor(
      Math.random() *
        available.length
    )
  ];
}

// ==================================================
// CREATE NOVA PERSONA
// ==================================================

app.post(
  "/api/agent/init",
  (req, res) => {
    try {
      const { persona } =
        req.body;

      if (
        !persona?.name ||
        !persona?.domain
      ) {
        return res.status(400).json({
          error:
            "Persona name and domain are required.",
        });
      }

      const agentId =
        "nova_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .substring(2, 8);

      const createdAt =
        new Date().toISOString();

      db.prepare(`
        INSERT INTO agents (
          id,
          name,
          domain,
          created_at,
          last_run
        )
        VALUES (?, ?, ?, ?, ?)
      `).run(
        agentId,
        persona.name,
        persona.domain,
        createdAt,
        null
      );

      console.log(
        "Created Nova agent:",
        agentId
      );

      res.json({
        success: true,

        agentId,

        persona: {
          name: persona.name,
          domain: persona.domain,
        },
      });
    } catch (error) {
      console.error(
        "Agent creation error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to create Nova persona.",
      });
    }
  }
);

// ==================================================
// GET NOVA FEED
// ==================================================

app.get(
  "/api/agent/feed",
  (req, res) => {
    try {
      const { agentId } =
        req.query;

      if (!agentId) {
        return res.status(400).json({
          error:
            "agentId is required.",
        });
      }

      const agent = db
        .prepare(`
          SELECT
            id,
            name,
            domain,
            created_at,
            last_run
          FROM agents
          WHERE id = ?
        `)
        .get(agentId);

      if (!agent) {
        return res.status(404).json({
          error:
            "Nova agent not found.",
        });
      }

      const posts = db
        .prepare(`
          SELECT
            id,
            title,
            text,
            score,
            rationale,
            why_selected AS whySelected,
            why_relevant_now AS whyRelevantNow,
            sources,
            created_at AS createdAt
          FROM posts
          WHERE agent_id = ?
          ORDER BY created_at DESC
        `)
        .all(agentId);

      res.json({
        success: true,

        posts,

        persona: {
          name: agent.name,
          domain: agent.domain,
        },

        lastRun:
          agent.last_run,
      });
    } catch (error) {
      console.error(
        "Feed error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load Nova feed.",
      });
    }
  }
);

// ==================================================
// RUN AUTONOMOUS INTELLIGENCE
// ==================================================

app.post(
  "/api/agent/run",
  async (req, res) => {
    try {
      const { agentId } =
        req.body;

      if (!agentId) {
        return res.status(400).json({
          error:
            "agentId is required.",
        });
      }

      const agent = db
        .prepare(`
          SELECT *
          FROM agents
          WHERE id = ?
        `)
        .get(agentId);

      if (!agent) {
        return res.status(404).json({
          error:
            "Nova agent not found.",
        });
      }

      console.log(
        `Nova intelligence cycle started for ${agentId}`
      );

      const prompt = `
You are Nova, an autonomous AI technology analyst.

Your domain is:
${agent.domain}

Select one important AI technology development
that deserves editorial attention.

You MUST return exactly one JSON object.

DO NOT:

- use markdown
- use code fences
- write explanations before the JSON
- write explanations after the JSON
- add comments
- add trailing commas

Return ONLY this JSON structure:

{
  "title": "short title",
  "summary": "2-3 sentence summary",
  "score": 0,
  "whySelected": "why this topic matters",
  "whyRelevantNow": "why this matters now"
}

Rules:

- score must be an integer between 0 and 100
- focus on AI technology
- prefer technically important developments
- avoid generic statements
- make the decision editorially useful
`;

      let result;

      let usedFallback =
        false;

      let aiSource =
        "Gemini";

      let reason =
        "Nova discovered, evaluated, selected and remembered a new AI development.";

      // ==================================================
      // TRY GEMINI
      // ==================================================

      try {
        console.log(
          `Trying Gemini (${GEMINI_MODEL})...`
        );

        const rawGemini =
          await askGemini(prompt);

        console.log(
          "Gemini response received."
        );

        result =
          parseGeminiJson(
            rawGemini
          );
      } catch (geminiError) {
        usedFallback =
          true;

        aiSource =
          "Nova fallback";

        console.warn(
          "Gemini unavailable. Using Nova fallback."
        );

        console.warn(
          "Gemini reason:",
          geminiError.message
        );

        if (
          isGeminiCoolingDown()
        ) {
          reason =
            `Gemini is temporarily rate-limited or quota-limited. Nova used its autonomous fallback intelligence. Retry window: ${getCooldownSeconds()} seconds.`;
        } else {
          reason =
            "Gemini was unavailable, so Nova used its autonomous fallback intelligence and saved the result to SQLite.";
        }

        result =
          getFallbackTopic(agent);
      }

      // ==================================================
      // NORMALIZE RESULT
      // ==================================================

      const title =
        result.title ||
        "AI technology development";

      const summary =
        result.summary ||
        "Nova identified an important development in AI technology.";

      const score =
        Math.max(
          0,
          Math.min(
            100,
            Number(result.score) || 0
          )
        );

      const whySelected =
        result.whySelected ||
        "Nova selected this topic because it has strong relevance to AI technology.";

      const whyRelevantNow =
        result.whyRelevantNow ||
        "This development is relevant to the current AI ecosystem.";

      // ==================================================
      // DUPLICATE CHECK
      // ==================================================

      const duplicate = db
        .prepare(`
          SELECT id
          FROM posts
          WHERE agent_id = ?
          AND title = ?
          LIMIT 1
        `)
        .get(
          agentId,
          title
        );

      const now =
        new Date().toISOString();

      if (duplicate) {
        db.prepare(`
          UPDATE agents
          SET last_run = ?
          WHERE id = ?
        `).run(
          now,
          agentId
        );

        return res.json({
          success: true,

          result: {
            published: false,

            duplicate: true,

            topic: title,

            aiSource,

            reason:
              "Nova found existing content in its memory and avoided repeating it.",
          },
        });
      }

      // ==================================================
      // SAVE POST
      // ==================================================

      const postId =
        "post_" +
        Date.now() +
        "_" +
        Math.random()
          .toString(36)
          .substring(2, 7);

      const text =
        `${title}\n\n${summary}`;

      const sources =
        JSON.stringify([
          {
            title:
              usedFallback
                ? "Nova autonomous fallback analysis"
                : "Gemini autonomous analysis",

            url:
              "https://ai.google.dev/",
          },
        ]);

      db.prepare(`
        INSERT INTO posts (
          id,
          agent_id,
          title,
          text,
          score,
          rationale,
          why_selected,
          why_relevant_now,
          sources,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        postId,
        agentId,
        title,
        text,
        score,
        whySelected,
        whySelected,
        whyRelevantNow,
        sources,
        now
      );

      // ==================================================
      // UPDATE NOVA MEMORY
      // ==================================================

      db.prepare(`
        UPDATE agents
        SET last_run = ?
        WHERE id = ?
      `).run(
        now,
        agentId
      );

      const post = {
        id: postId,

        title,

        text,

        score,

        rationale:
          whySelected,

        whySelected,

        whyRelevantNow,

        sources,

        createdAt: now,
      };

      console.log(
        "Nova published:",
        title
      );

      console.log(
        "AI source:",
        aiSource
      );

      res.json({
        success: true,

        result: {
          published: true,

          duplicate: false,

          topic: title,

          aiSource,

          reason,

          post,
        },
      });
    } catch (error) {
      console.error(
        "Intelligence cycle error:",
        error
      );

      res.status(500).json({
        error:
          error.message ||
          "Nova could not complete the intelligence cycle.",
      });
    }
  }
);

// ==================================================
// DELETE NOVA PERSONA
// ==================================================

app.delete(
  "/api/agent/:agentId",
  (req, res) => {
    try {
      const { agentId } =
        req.params;

      const agent = db
        .prepare(`
          SELECT id
          FROM agents
          WHERE id = ?
        `)
        .get(agentId);

      if (!agent) {
        return res.status(404).json({
          error:
            "Agent not found.",
        });
      }

      db.prepare(`
        DELETE FROM posts
        WHERE agent_id = ?
      `).run(agentId);

      db.prepare(`
        DELETE FROM agents
        WHERE id = ?
      `).run(agentId);

      res.json({
        success: true,

        message:
          "Nova persona deleted successfully.",
      });
    } catch (error) {
      console.error(
        "Delete agent error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to delete Nova persona.",
      });
    }
  }
);

// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");

    console.log(
      "======================================"
    );

    console.log(
      "       NOVA BACKEND ONLINE"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Server: http://0.0.0.0:${PORT}`
    );

    console.log(
      `Health: http://0.0.0.0:${PORT}/api/health`
    );

    console.log(
      "Database: SQLite"
    );

    console.log(
      GEMINI_API_KEY
        ? `Gemini: configured (${GEMINI_MODEL})`
        : "Gemini: not configured"
    );

    console.log(
      "Fallback intelligence: enabled"
    );

    console.log(
      "Quota protection: enabled"
    );

    console.log(
      "======================================"
    );

    console.log("");
  }
);
