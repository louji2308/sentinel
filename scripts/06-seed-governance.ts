import "dotenv/config";
import crypto from "crypto";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.SENTINEL_DB_DIR || "./data";
const DB_PATH = path.join(DB_DIR, "sentinel.db");
fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001";

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

async function callOracle(endpoint: string, body: unknown) {
  const res = await fetch(`${ORACLE_URL}/api/governance/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${endpoint} failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function main() {
  console.log("Seeding governance data...\n");

  const now = Date.now();
  const DAY = 86400000;

  // --- Proposals (seeded via API so they get proper validation)
  const proposals = [
    {
      action: "revoke_agent",
      targetId: "did:t3n:rogue-agent-demo",
      decision: "APPROVE" as const,
      requiredVotes: 2,
    },
    {
      action: "update_spend_limit",
      targetId: "did:t3n:hr-payroll-demo",
      decision: "APPROVE" as const,
      requiredVotes: 3,
    },
    {
      action: "emergency_pause",
      targetId: "system:compliance:all",
      decision: "DENY" as const,
      requiredVotes: 2,
    },
  ];

  for (const p of proposals) {
    try {
      const result = await callOracle("proposals", p);
      console.log(`  Proposal ${result.proposalId} (${p.action}) -> OK`);
    } catch (err: any) {
      console.log(`  Proposal ${p.action} -> ${err.message}`);
    }
  }

  // --- Escalations (inserted directly into DB since there's no create endpoint)
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
    INSERT OR REPLACE INTO escalations (escalation_id, agent_did, request_id, action, amount, reason, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `);

  for (const esc of escalations) {
    insertEsc.run(esc.escalationId, esc.agentDid, esc.requestId, JSON.stringify(esc.action), esc.amount, esc.reason, esc.createdAt);
    console.log(`  Escalation ${esc.escalationId} (${esc.agentDid}) -> OK`);
  }

  db.close();
  console.log("\nGovernance data seeded successfully!");
  console.log(`  Proposals: ${proposals.length}`);
  console.log(`  Escalations: ${escalations.length}`);
  console.log("\nView at http://localhost:3000/governance");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
