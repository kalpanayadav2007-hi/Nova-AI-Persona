import Database from "better-sqlite3";
import path from "path";
import { config } from "../config/env";

const db = new Database(path.resolve(config.dbPath));

export default db;