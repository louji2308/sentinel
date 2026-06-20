import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const TEST_DB_DIR = path.join(process.cwd(), ".test-data");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "sentinel-test.db");

let db: Database.Database;

beforeAll(() => {
  fs.mkdirSync(TEST_DB_DIR, { recursive: true });
  db = new Database(TEST_DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      did TEXT PRIMARY KEY,
      credential_type TEXT NOT NULL,
      credential_status TEXT NOT NULL DEFAULT 'active',
      scope TEXT NOT NULL DEFAULT '[]',
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS spend_ledger (
      did TEXT NOT NULL,
      window_key TEXT NOT NULL,
      window_type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (did, window_key, window_type)
    );
    CREATE TABLE IF NOT EXISTS request_cache (
      request_id TEXT PRIMARY KEY,
      response TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS receipts (
      receipt_id TEXT PRIMARY KEY,
      agent_did TEXT NOT NULL,
      decision TEXT NOT NULL,
      policy_hash TEXT NOT NULL,
      policy_clause TEXT NOT NULL,
      issued_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      signature TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      agent_did TEXT NOT NULL,
      decision TEXT NOT NULL,
      policy_clause TEXT NOT NULL,
      action TEXT NOT NULL,
      receipt_id TEXT
    );
  `);
});

afterAll(() => {
  db.close();
  fs.rmSync(TEST_DB_DIR, { recursive: true, force: true });
});

describe("spend_ledger", () => {
  function getWindowKey(timestampMs: number, type: "hourly" | "daily" | "weekly"): string {
    const ts = Math.floor(timestampMs / 1000);
    if (type === "hourly") return String(Math.floor(ts / 3600));
    if (type === "weekly") return String(Math.floor(ts / 604800));
    return String(Math.floor(ts / 86400));
  }

  function recordSpend(did: string, amount: number, timestampMs: number, windowType: "hourly" | "daily" | "weekly"): void {
    const windowKey = getWindowKey(timestampMs, windowType);
    const ts = Math.floor(timestampMs);
    db.prepare(`
      INSERT INTO spend_ledger (did, window_key, window_type, amount, timestamp)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(did, window_key, window_type) DO UPDATE SET amount = amount + excluded.amount, timestamp = MAX(timestamp, excluded.timestamp)
    `).run(did, windowKey, windowType, Math.floor(amount), ts);
  }

  function getCumulativeSpend(did: string, timestampMs: number, windowType: "hourly" | "daily" | "weekly"): number {
    const windowKey = getWindowKey(timestampMs, windowType);
    const row = db.prepare(
      "SELECT amount FROM spend_ledger WHERE did = ? AND window_key = ? AND window_type = ?"
    ).get(did, windowKey, windowType) as { amount: number } | undefined;
    return row?.amount ?? 0;
  }

  it("records spend and accumulates within same window", () => {
    const ts = Date.now();
    recordSpend("test-agent", 500, ts, "daily");
    expect(getCumulativeSpend("test-agent", ts, "daily")).toBe(500);
    recordSpend("test-agent", 300, ts, "daily");
    expect(getCumulativeSpend("test-agent", ts, "daily")).toBe(800);
  });

  it("separates hourly and daily windows", () => {
    const ts = Date.now();
    recordSpend("test-agent-2", 1000, ts, "hourly");
    expect(getCumulativeSpend("test-agent-2", ts, "daily")).toBe(0);
    expect(getCumulativeSpend("test-agent-2", ts, "hourly")).toBe(1000);
  });

  it("returns zero for unknown agents", () => {
    expect(getCumulativeSpend("nonexistent", Date.now(), "daily")).toBe(0);
  });
});

describe("request_cache", () => {
  it("stores and retrieves cached responses", () => {
    db.prepare("INSERT OR REPLACE INTO request_cache (request_id, response, created_at) VALUES (?, ?, ?)")
      .run("test-req", JSON.stringify({ decision: "PERMIT" }), Date.now());

    const row = db.prepare("SELECT response FROM request_cache WHERE request_id = ? AND created_at > ?")
      .get("test-req", Date.now() - 86400000) as { response: string } | undefined;

    expect(row).toBeDefined();
    expect(JSON.parse(row!.response)).toEqual({ decision: "PERMIT" });
  });

  it("expires stale entries", () => {
    db.prepare("INSERT OR REPLACE INTO request_cache (request_id, response, created_at) VALUES (?, ?, ?)")
      .run("stale-req", JSON.stringify({ decision: "DENY" }), Date.now() - 90000000);

    const row = db.prepare("SELECT response FROM request_cache WHERE request_id = ? AND created_at > ?")
      .get("stale-req", Date.now() - 86400000) as { response: string } | undefined;

    expect(row).toBeUndefined();
  });
});

describe("receipts", () => {
  it("persists and retrieves receipts", () => {
    db.prepare(`
      INSERT INTO receipts (receipt_id, agent_did, decision, policy_hash, policy_clause, issued_at, expires_at, signature)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run("rcpt-test-1", "did:test:agent", "PERMIT", "abc123", "permit(...)", Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000) + 86400, "sig-abc");

    const row = db.prepare("SELECT * FROM receipts WHERE receipt_id = ?").get("rcpt-test-1") as any;
    expect(row).toBeDefined();
    expect(row.agent_did).toBe("did:test:agent");
    expect(row.decision).toBe("PERMIT");
  });
});

describe("audit_log", () => {
  it("inserts and queries audit entries", () => {
    const entry = {
      id: "audit-test-1",
      timestamp: Date.now(),
      agentDid: "did:test:agent",
      decision: "DENY",
      policyClause: "forbid(...)",
      action: JSON.stringify({ type: "execute_payment", resource: "PaymentRail" }),
      receiptId: "rcpt-test-deny",
    };

    db.prepare(`
      INSERT INTO audit_log (id, timestamp, agent_did, decision, policy_clause, action, receipt_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entry.id, entry.timestamp, entry.agentDid, entry.decision, entry.policyClause, entry.action, entry.receiptId);

    const rows = db.prepare("SELECT * FROM audit_log WHERE agent_did = ? ORDER BY timestamp DESC").all("did:test:agent") as any[];
    expect(rows.length).toBe(1);
    expect(rows[0].decision).toBe("DENY");
  });
});
