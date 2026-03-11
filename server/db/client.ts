import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(__dirname, "../../storage");
const DB_PATH = path.join(STORAGE_DIR, "brain-hub.db");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    // Ensure storage directory exists
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Run schema
    const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
    db.exec(schema);
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
