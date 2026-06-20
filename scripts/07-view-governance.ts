import "dotenv/config";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.SENTINEL_DB_DIR || "./data";
const DB_PATH = path.join(DB_DIR, "sentinel.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("Database not found. Run the oracle server + demo first.");
  process.exit(1);
}

const db = new Database(DB_PATH);

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function fmtDID(did: string): string {
  const parts = did.split(":");
  return parts.length > 2 ? "..." + parts.slice(-2).join(":") : did;
}

console.log("╔══════════════════════════════════════════╗");
console.log("║        GOVERNANCE DATA VIEWER            ║");
console.log("╚══════════════════════════════════════════╝\n");

// --- Proposals
const proposals = db.prepare(`
  SELECT * FROM proposals ORDER BY created_at DESC
`).all() as Record<string, unknown>[];

console.log(`PROPOSALS (${proposals.length}):`);
console.log("─".repeat(80));
if (proposals.length === 0) {
  console.log("  No proposals found.\n");
} else {
  for (const p of proposals) {
    const votes = JSON.parse(p.votes as string) as { operator: string; approve: boolean }[];
    const yea = votes.filter(v => v.approve).length;
    const nay = votes.filter(v => !v.approve).length;
    console.log(`  ID:       ${p.proposal_id}`);
    console.log(`  Action:   ${p.action}`);
    console.log(`  Target:   ${p.target_id}`);
    console.log(`  Status:   ${p.status}  (${yea} yea / ${nay} nay of ${p.required_votes} required)`);
    if (votes.length > 0) {
      for (const v of votes) {
        console.log(`    Vote:    ${fmtDID(v.operator)} -> ${v.approve ? "YEA" : "NAY"}`);
      }
    }
    console.log(`  Created:  ${fmtTime(p.created_at as number)}`);
    console.log(`  Expires:  ${fmtTime(p.expires_at as number)}`);
    console.log();
  }
}

// --- Escalations
const escalations = db.prepare(`
  SELECT * FROM escalations ORDER BY created_at DESC
`).all() as Record<string, unknown>[];

console.log(`ESCALATIONS (${escalations.length}):`);
console.log("─".repeat(80));
if (escalations.length === 0) {
  console.log("  No escalations found.\n");
} else {
  for (const e of escalations) {
    console.log(`  ID:       ${e.escalation_id}`);
    console.log(`  Agent:    ${e.agent_did}`);
    console.log(`  Amount:   $${(e.amount as number).toLocaleString()}`);
    console.log(`  Reason:   ${e.reason}`);
    console.log(`  Status:   ${e.status}`);
    console.log(`  Created:  ${fmtTime(e.created_at as number)}`);
    if (e.resolved_at) {
      console.log(`  Resolved: ${fmtTime(e.resolved_at as number)}`);
      console.log(`  Decision: ${e.resolution}`);
      console.log(`  By:       ${e.resolved_by}`);
    }
    console.log();
  }
}

db.close();
