import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.SENTINEL_DB_DIR || "./data";
const DB_PATH = path.join(DB_DIR, "sentinel.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("Database not found at", DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);

const info = db.prepare("DELETE FROM spend_ledger").run();
console.log("Cleared spend_ledger:", info.changes, "rows deleted");

const remaining = db.prepare("SELECT COUNT(*) as cnt FROM spend_ledger").get() as { cnt: number };
console.log("Remaining rows in spend_ledger:", remaining.cnt);

db.close();
