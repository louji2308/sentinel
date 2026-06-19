// ────────────────────────────────────────────────────────────────────────────
// GENERATE AGENT KEYS + ORACLE SECRET
// Run once: npx tsx scripts/generate-agent-keys.ts
// Prints values to paste into .env — does NOT write .env automatically,
// so you don't accidentally overwrite values you've already set.
// ────────────────────────────────────────────────────────────────────────────

import crypto from "crypto";

function randomEthPrivateKey(): string {
  // 32 random bytes, hex-encoded, 0x-prefixed — standard Ethereum private key format
  return "0x" + crypto.randomBytes(32).toString("hex");
}

function randomOracleSecret(): string {
  return crypto.randomBytes(24).toString("hex"); // 48 hex chars, well over the 32-char minimum
}

console.log("Paste these into your .env file:\n");
console.log(`TRAVEL_AGENT_KEY=${randomEthPrivateKey()}`);
console.log(`HR_PAYROLL_AGENT_KEY=${randomEthPrivateKey()}`);
console.log(`ROGUE_AGENT_KEY=${randomEthPrivateKey()}`);
console.log(`ORACLE_SECRET=${randomOracleSecret()}`);
console.log("\nThese are testnet-only demo keys. Do not fund them or use them outside this hackathon.");