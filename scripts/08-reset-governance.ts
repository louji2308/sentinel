import "dotenv/config";
import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.SENTINEL_DB_DIR || "./data";
const DB_PATH = path.join(DB_DIR, "sentinel.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("Database not found at", DB_PATH);
  console.error("Start the oracle server first, then run this script.");
  process.exit(1);
}

const db = new Database(DB_PATH);

console.log("=== CURRENT ESCALATIONS ===");
const escs = db.prepare("SELECT * FROM escalations").all();
console.table(escs);

console.log("\n=== CURRENT PROPOSALS ===");
const props = db.prepare("SELECT * FROM proposals").all();
console.table(props);

// --- Delete existing pending escalations and proposals
db.prepare("DELETE FROM escalations").run();
db.prepare("DELETE FROM proposals").run();
console.log("\nCleared all escalations and proposals.");

// --- Re-seed 3 pending escalations
const now = Date.now();
const DAY = 86400000;

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

const escalations = [
  {
    escalationId: generateId("ESC"),
    agentDid: "did:t3n:travel-agent-demo",
    requestId: `req-${now}-seed-1`,
    action: { type: "book_flight", resource: "FlightSystem", amount: 4500, metadata: { domain: "travel" } },
    amount: 4500,
    reason: "Booking amount $4,500 exceeds agent spend cap of $5,000 at 90% threshold. Escalating for operator review.",
    createdAt: now - DAY / 2,
  },
  {
    escalationId: generateId("ESC"),
    agentDid: "did:t3n:expense-agent-demo",
    requestId: `req-${now}-seed-2`,
    action: { type: "submit_expense", resource: "ExpenseSystem", amount: 4200, metadata: { domain: "expense" } },
    amount: 4200,
    reason: "Expense submission $4,200 is near the $5,000 spend cap. Requires human approval before processing.",
    createdAt: now - DAY / 4,
  },
  {
    escalationId: generateId("ESC"),
    agentDid: "did:t3n:hr-payroll-demo",
    requestId: `req-${now}-seed-3`,
    action: { type: "execute_payment", resource: "PaymentRail", amount: 85000, metadata: { domain: "payroll" } },
    amount: 85000,
    reason: "Payroll run $85,000 exceeds hourly burst threshold. Operator review required before processing.",
    createdAt: now - DAY / 8,
  },
];

const insertEsc = db.prepare(`
  INSERT INTO escalations (escalation_id, agent_did, request_id, action, amount, reason, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
`);

for (const esc of escalations) {
  insertEsc.run(esc.escalationId, esc.agentDid, esc.requestId, JSON.stringify(esc.action), esc.amount, esc.reason, esc.createdAt);
  console.log(`  Escalation ${esc.escalationId} (${esc.agentDid}) -> OK`);
}

// --- Re-seed 2 proposals
const proposals = [
  {
    action: "revoke_agent",
    targetId: "did:t3n:rogue-agent-demo",
    decision: "APPROVE",
    requiredVotes: 2,
  },
  {
    action: "update_spend_limit",
    targetId: "did:t3n:hr-payroll-demo",
    decision: "APPROVE",
    requiredVotes: 3,
  },
];

const insertProp = db.prepare(`
  INSERT INTO proposals (proposal_id, action, target_id, decision, required_votes, votes, status, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?, '[]', 'pending', ?, ?)
`);

for (const p of proposals) {
  const pid = generateId("PROP");
  const expiresAt = now + 7 * DAY;
  insertProp.run(pid, p.action, p.targetId, p.decision, p.requiredVotes, now, expiresAt);
  console.log(`  Proposal ${pid} (${p.action}) -> OK`);
}

db.close();
console.log("\nReset complete! 3 pending escalations + 2 proposals restored.");
console.log("Refresh the governance tab to see them.");
