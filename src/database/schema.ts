import db from "./db";

db.exec(`
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    initializedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    text TEXT NOT NULL,
    rationale TEXT,
    sources TEXT
);

CREATE TABLE IF NOT EXISTS rejected_topics (
    id TEXT PRIMARY KEY,
    agentId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    title TEXT NOT NULL,
    reason TEXT,
    score REAL
);
`);

console.log("✅ SQLite Connected");
console.log("✅ Database Ready");

export default db;