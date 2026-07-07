import dotenv from "dotenv";
dotenv.config();

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = process.env.DATABASE_PATH || "./data/wedding.db";

// Ensure the directory for the database file exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Enable foreign key enforcement
db.pragma("foreign_keys = ON");

// Read and execute schema on startup
const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");
db.exec(schema);

console.log("База данных инициализирована:", dbPath);

export default db;
