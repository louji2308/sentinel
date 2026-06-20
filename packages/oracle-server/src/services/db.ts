import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.SENTINEL_DB_DIR || "./data";
const DB_PATH = path.join(DB_DIR, "sentinel.db");

fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

class StmtCache {
  private cache = new Map<string, Database.Statement>();

  get(sql: string): Database.Statement {
    let stmt = this.cache.get(sql);
    if (!stmt) {
      stmt = db.prepare(sql);
      this.cache.set(sql, stmt);
    }
    return stmt;
  }

  clear(): void {
    this.cache.clear();
  }
}

const stmt = new StmtCache();

const MIGRATIONS: string[] = [
  `ALTER TABLE spend_ledger ADD COLUMN timestamp INTEGER NOT NULL DEFAULT 0`,
];

for (const sql of MIGRATIONS) {
  try { db.exec(sql); } catch { }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    did              TEXT PRIMARY KEY,
    credential_type  TEXT NOT NULL,
    credential_status TEXT NOT NULL DEFAULT 'active',
    scope            TEXT NOT NULL DEFAULT '[]',
    issued_at        INTEGER NOT NULL,
    expires_at       INTEGER NOT NULL,
    updated_at       INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id           TEXT PRIMARY KEY,
    timestamp    INTEGER NOT NULL,
    agent_did    TEXT NOT NULL,
    decision     TEXT NOT NULL,
    policy_clause TEXT NOT NULL,
    action       TEXT NOT NULL,
    receipt_id   TEXT NOT NULL,
    operator_action TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_did);

  CREATE TABLE IF NOT EXISTS escalations (
    escalation_id TEXT PRIMARY KEY,
    agent_did     TEXT NOT NULL,
    request_id    TEXT NOT NULL,
    action        TEXT NOT NULL,
    amount        REAL NOT NULL DEFAULT 0,
    reason        TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    INTEGER NOT NULL,
    resolved_at   INTEGER,
    resolution    TEXT,
    resolved_by   TEXT
  );

  CREATE TABLE IF NOT EXISTS spend_ledger (
    did         TEXT NOT NULL,
    window_key  TEXT NOT NULL,
    window_type TEXT NOT NULL DEFAULT 'daily',
    amount      INTEGER NOT NULL DEFAULT 0,
    timestamp   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (did, window_key, window_type)
  );

  CREATE TABLE IF NOT EXISTS receipts (
    receipt_id   TEXT PRIMARY KEY,
    agent_did    TEXT NOT NULL,
    decision     TEXT NOT NULL,
    policy_hash  TEXT NOT NULL,
    policy_clause TEXT NOT NULL,
    issued_at    INTEGER NOT NULL,
    expires_at   INTEGER NOT NULL,
    signature    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS proposals (
    proposal_id   TEXT PRIMARY KEY,
    action        TEXT NOT NULL,
    target_id     TEXT NOT NULL,
    decision      TEXT NOT NULL,
    required_votes INTEGER NOT NULL DEFAULT 1,
    votes         TEXT NOT NULL DEFAULT '[]',
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    INTEGER NOT NULL,
    expires_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS request_cache (
    request_id   TEXT PRIMARY KEY,
    response     TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_request_cache_created ON request_cache(created_at);
`);

function getWindowKey(timestampMs: number, type: "hourly" | "daily" | "weekly"): string {
  const ts = Math.floor(timestampMs / 1000);
  if (type === "hourly") return String(Math.floor(ts / 3600));
  if (type === "weekly") return String(Math.floor(ts / 604800));
  return String(Math.floor(ts / 86400));
}

const recordSpendStmt = stmt.get(`
  INSERT INTO spend_ledger (did, window_key, window_type, amount, timestamp)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(did, window_key, window_type) DO UPDATE SET amount = amount + excluded.amount, timestamp = MAX(timestamp, excluded.timestamp)
`);

const recordSpendTx = db.transaction((entries: [string, number, number, "hourly" | "daily" | "weekly"][]) => {
  for (const [did, amount, ts, windowType] of entries) {
    const windowKey = getWindowKey(ts, windowType);
    recordSpendStmt.run(did, windowKey, windowType, Math.floor(amount), Math.floor(ts));
  }
});

export function recordSpend(did: string, amount: number, timestampMs: number, windowType: "hourly" | "daily" | "weekly"): void {
  const entries: [string, number, number, "hourly" | "daily" | "weekly"][] = [
    [did, amount, timestampMs, windowType],
  ];
  recordSpendTx(entries);
}

export function recordSpendBatch(did: string, amount: number, timestampMs: number): void {
  const entries: [string, number, number, "hourly" | "daily" | "weekly"][] = [
    [did, amount, timestampMs, "daily"],
    [did, amount, timestampMs, "hourly"],
    [did, amount, timestampMs, "weekly"],
  ];
  recordSpendTx(entries);
}

const getCumulativeSpendStmt = stmt.get(
  "SELECT amount FROM spend_ledger WHERE did = ? AND window_key = ? AND window_type = ?"
);

const getSpendHistoryStmt = stmt.get(`
  SELECT window_key, amount FROM spend_ledger
  WHERE did = ? AND window_type = ?
  ORDER BY window_key DESC LIMIT ?
`);

export function getCumulativeSpend(did: string, timestampMs: number, windowType: "hourly" | "daily" | "weekly"): number {
  const windowKey = getWindowKey(timestampMs, windowType);
  const row = getCumulativeSpendStmt.get(did, windowKey, windowType) as { amount: number } | undefined;
  return row?.amount ?? 0;
}

export function getSpendHistory(did: string, windowType: "daily", limit = 30) {
  return getSpendHistoryStmt.all(did, windowType, limit) as { window_key: string; amount: number }[];
}

export function upsertAgent(agent: {
  did: string;
  credentialType: string;
  credentialStatus: "active" | "revoked" | "suspended";
  scope: string[];
  issuedAt: number;
  expiresAt: number;
}): void {
  db.prepare(`
    INSERT INTO agents (did, credential_type, credential_status, scope, issued_at, expires_at, updated_at)
    VALUES (@did, @credentialType, @credentialStatus, @scope, @issuedAt, @expiresAt, @now)
    ON CONFLICT(did) DO UPDATE SET
      credential_type = excluded.credential_type,
      credential_status = excluded.credential_status,
      scope = excluded.scope,
      issued_at = excluded.issued_at,
      expires_at = excluded.expires_at,
      updated_at = excluded.updated_at
  `).run({
    did: agent.did,
    credentialType: agent.credentialType,
    credentialStatus: agent.credentialStatus,
    scope: JSON.stringify(agent.scope),
    issuedAt: agent.issuedAt,
    expiresAt: agent.expiresAt,
    now: Date.now(),
  });
}

export function getAgent(did: string) {
  const row = db.prepare("SELECT * FROM agents WHERE did = ?").get(did) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    did: row.did as string,
    credentialType: row.credential_type as string,
    credentialStatus: row.credential_status as "active" | "revoked" | "suspended",
    scope: JSON.parse(row.scope as string) as string[],
    issuedAt: row.issued_at as number,
    expiresAt: row.expires_at as number,
  };
}

export function getAllAgents() {
  return (db.prepare("SELECT * FROM agents ORDER BY updated_at DESC").all() as Record<string, unknown>[]).map(row => ({
    did: row.did as string,
    credentialType: row.credential_type as string,
    credentialStatus: row.credential_status as "active" | "revoked" | "suspended",
    scope: JSON.parse(row.scope as string) as string[],
    issuedAt: row.issued_at as number,
    expiresAt: row.expires_at as number,
  }));
}

export function updateAgentStatus(did: string, status: "active" | "revoked" | "suspended"): boolean {
  const result = db.prepare("UPDATE agents SET credential_status = ?, updated_at = ? WHERE did = ?")
    .run(status, Date.now(), did);
  return result.changes > 0;
}

export function insertAuditEntry(entry: {
  id: string;
  timestamp: number;
  agentDid: string;
  decision: string;
  policyClause: string;
  action: unknown;
  receiptId: string;
  operatorAction?: string;
}): void {
  db.prepare(`
    INSERT OR IGNORE INTO audit_log (id, timestamp, agent_did, decision, policy_clause, action, receipt_id, operator_action)
    VALUES (@id, @timestamp, @agentDid, @decision, @policyClause, @action, @receiptId, @operatorAction)
  `).run({
    id: entry.id,
    timestamp: entry.timestamp,
    agentDid: entry.agentDid,
    decision: entry.decision,
    policyClause: entry.policyClause,
    action: JSON.stringify(entry.action),
    receiptId: entry.receiptId,
    operatorAction: entry.operatorAction ?? null,
  });
}

export function getAuditLog(since = 0, limit = 200) {
  return (db.prepare(`
    SELECT * FROM audit_log WHERE timestamp >= ? ORDER BY timestamp DESC LIMIT ?
  `).all(since, limit) as Record<string, unknown>[]).map(row => ({
    id: row.id as string,
    timestamp: row.timestamp as number,
    agentDid: row.agent_did as string,
    decision: row.decision as string,
    policyClause: row.policy_clause as string,
    action: JSON.parse(row.action as string),
    receiptId: row.receipt_id as string,
    operatorAction: row.operator_action as string | undefined,
  }));
}

export function findAuditEntry(receiptId: string) {
  const row = db.prepare("SELECT * FROM audit_log WHERE receipt_id = ?").get(receiptId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    id: row.id as string,
    timestamp: row.timestamp as number,
    agentDid: row.agent_did as string,
    decision: row.decision as string,
    policyClause: row.policy_clause as string,
    action: JSON.parse(row.action as string),
    receiptId: row.receipt_id as string,
  };
}

export function insertEscalation(esc: {
  escalationId: string;
  agentDid: string;
  requestId: string;
  action: unknown;
  amount: number;
  reason: string;
}): void {
  db.prepare(`
    INSERT OR IGNORE INTO escalations
    (escalation_id, agent_did, request_id, action, amount, reason, status, created_at)
    VALUES (@escalationId, @agentDid, @requestId, @action, @amount, @reason, 'pending', @createdAt)
  `).run({
    escalationId: esc.escalationId,
    agentDid: esc.agentDid,
    requestId: esc.requestId,
    action: JSON.stringify(esc.action),
    amount: esc.amount,
    reason: esc.reason,
    createdAt: Date.now(),
  });
}

export function resolveEscalationDB(escalationId: string, decision: "APPROVE" | "DENY", resolvedBy: string, reason: string): boolean {
  const status = decision === "APPROVE" ? "approved" : "denied";
  const result = db.prepare(`
    UPDATE escalations SET status = ?, resolved_at = ?, resolution = ?, resolved_by = ?
    WHERE escalation_id = ? AND status = 'pending'
  `).run(status, Date.now(), reason, resolvedBy, escalationId);
  return result.changes > 0;
}

export function getPendingEscalations() {
  return (db.prepare("SELECT * FROM escalations WHERE status = 'pending' ORDER BY created_at DESC").all() as Record<string, unknown>[])
    .map(row => ({
      escalationId: row.escalation_id as string,
      agentDid: row.agent_did as string,
      requestId: row.request_id as string,
      action: JSON.parse(row.action as string),
      amount: row.amount as number,
      reason: row.reason as string,
      status: row.status as string,
      createdAt: row.created_at as number,
    }));
}

export function upsertReceipt(r: {
  receiptId: string;
  agentDid: string;
  decision: string;
  policyHash: string;
  policyClause: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
}): void {
  db.prepare(`
    INSERT OR IGNORE INTO receipts
    (receipt_id, agent_did, decision, policy_hash, policy_clause, issued_at, expires_at, signature)
    VALUES (@receiptId, @agentDid, @decision, @policyHash, @policyClause, @issuedAt, @expiresAt, @signature)
  `).run(r);
}

export function getReceipt(receiptId: string) {
  return db.prepare("SELECT * FROM receipts WHERE receipt_id = ?").get(receiptId) as Record<string, unknown> | undefined;
}

export function insertProposal(proposal: {
  proposalId: string;
  action: string;
  targetId: string;
  decision: string;
  requiredVotes: number;
  votes: unknown[];
  status: string;
  createdAt: number;
  expiresAt: number;
}): void {
  db.prepare(`
    INSERT OR IGNORE INTO proposals
    (proposal_id, action, target_id, decision, required_votes, votes, status, created_at, expires_at)
    VALUES (@proposalId, @action, @targetId, @decision, @requiredVotes, @votes, @status, @createdAt, @expiresAt)
  `).run({
    proposalId: proposal.proposalId,
    action: proposal.action,
    targetId: proposal.targetId,
    decision: proposal.decision,
    requiredVotes: proposal.requiredVotes,
    votes: JSON.stringify(proposal.votes),
    status: proposal.status,
    createdAt: proposal.createdAt,
    expiresAt: proposal.expiresAt,
  });
}

export function updateProposal(proposalId: string, updates: Partial<{ status: string; votes: unknown[] }>): void {
  const sets: string[] = [];
  const params: Record<string, unknown> = { proposalId };
  if (updates.status) { sets.push("status = @status"); params.status = updates.status; }
  if (updates.votes) { sets.push("votes = @votes"); params.votes = JSON.stringify(updates.votes); }
  if (sets.length > 0) {
    db.prepare(`UPDATE proposals SET ${sets.join(", ")} WHERE proposal_id = @proposalId`).run(params);
  }
}

export function getProposal(proposalId: string) {
  const row = db.prepare("SELECT * FROM proposals WHERE proposal_id = ?").get(proposalId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return {
    proposalId: row.proposal_id as string,
    action: row.action as string,
    targetId: row.target_id as string,
    decision: row.decision as string,
    requiredVotes: row.required_votes as number,
    votes: JSON.parse(row.votes as string) as unknown[],
    status: row.status as string,
    createdAt: row.created_at as number,
    expiresAt: row.expires_at as number,
  };
}

export function getPendingProposals() {
  const now = Date.now();
  return (db.prepare("SELECT * FROM proposals WHERE status = 'pending' AND expires_at > ? ORDER BY created_at DESC").all(now) as Record<string, unknown>[])
    .map(row => ({
      proposalId: row.proposal_id as string,
      action: row.action as string,
      targetId: row.target_id as string,
      decision: row.decision as string,
      requiredVotes: row.required_votes as number,
      votes: JSON.parse(row.votes as string) as unknown[],
      status: row.status as string,
      createdAt: row.created_at as number,
      expiresAt: row.expires_at as number,
    }));
}

const getCachedStmt = stmt.get("SELECT response FROM request_cache WHERE request_id = ? AND created_at > ?");
const setCachedStmt = stmt.get("INSERT OR REPLACE INTO request_cache (request_id, response, created_at) VALUES (?, ?, ?)");
const cacheCleanupStmt = stmt.get("DELETE FROM request_cache WHERE created_at < ?");

export function getCachedResponse(requestId: string): string | null {
  const row = getCachedStmt.get(requestId, Date.now() - 86400000) as { response: string } | undefined;
  return row?.response ?? null;
}

export function setCachedResponse(requestId: string, response: string): void {
  setCachedStmt.run(requestId, response, Date.now());
}

export function cacheCleanup(): void {
  cacheCleanupStmt.run(Date.now() - 86400000);
}

export function walCheckpoint(): void {
  db.pragma("wal_checkpoint(PASSIVE)");
}

const CACHE_CLEANUP_INTERVAL = 3600000;
let lastCleanup = 0;

export function periodicCleanup(): void {
  const now = Date.now();
  if (now - lastCleanup > CACHE_CLEANUP_INTERVAL) {
    lastCleanup = now;
    cacheCleanup();
    walCheckpoint();
  }
}

export function clearDb(): void {
  db.exec("DELETE FROM agents; DELETE FROM audit_log; DELETE FROM escalations; DELETE FROM spend_ledger; DELETE FROM receipts; DELETE FROM proposals; DELETE FROM request_cache;");
}

export function closeDb(): void {
  walCheckpoint();
  db.close();
}

export default db;
