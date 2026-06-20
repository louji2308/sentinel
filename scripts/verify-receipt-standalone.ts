/**
 * STANDALONE RECEIPT VERIFIER
 *
 * Verifies a SENTINEL compliance receipt directly against the T3N contract,
 * without trusting the oracle server at all.
 *
 * Usage:
 *   tsx scripts/verify-receipt-standalone.ts <receiptId> [agentDid]
 *
 * The verification is performed entirely through the TEE contract on the T3N
 * ledger — no intermediate server is trusted.
 */

import "dotenv/config";
import { getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, createTenantClient } from "../packages/t3-client/src/client.js";

async function main() {
  const receiptId = process.argv[2];
  const agentDid = process.argv[3] || "";

  if (!receiptId) {
    console.error("Usage: tsx scripts/verify-receipt-standalone.ts <receiptId> [agentDid]");
    process.exit(1);
  }

  const apiKey = process.env.T3N_API_KEY;
  const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
  const tenantDid = process.env.SENTINEL_TENANT_DID;
  const contractTail = process.env.CONTRACT_TAIL;
  const contractVersion = process.env.CONTRACT_VERSION ?? "1.0.0";

  if (!apiKey) { throw new Error("T3N_API_KEY not set in .env"); }
  if (!tenantDid) { throw new Error("SENTINEL_TENANT_DID not set in .env"); }
  if (!contractTail) { throw new Error("CONTRACT_TAIL not set in .env"); }

  const baseUrl = process.env.T3N_BASE_URL || getNodeUrl();
  const authClient = await createAuthenticatedClient(apiKey, environment);
  const tenantClient = await createTenantClient(authClient, tenantDid, baseUrl);

  const normalizedId = receiptId.startsWith("RCP-") || receiptId.startsWith("DENIED-")
    ? receiptId
    : `RCP-${receiptId}`;

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     SENTINEL — STANDALONE RECEIPT VERIFIER      ║");
  console.log("╚══════════════════════════════════════════════════╝");
  console.log(`  Receipt ID  : ${normalizedId}`);
  console.log(`  Agent DID   : ${agentDid || "(not specified)"}`);
  console.log(`  Contract    : ${contractTail}@${contractVersion}`);
  console.log(`  Tenant      : ${tenantDid}`);
  console.log("");

  console.log("[Verify] Calling verify-receipt on TEE contract...");
  const result = await tenantClient.contracts.execute(contractTail, {
    version: contractVersion,
    functionName: "verify-receipt",
    input: {
      receiptId: normalizedId,
      agentDid: agentDid,
    },
  });

  const verification = result as { valid: boolean; reason?: string };
  console.log("[Verify] Result:");

  if (verification.valid) {
    console.log(`  \u2705 STATUS : VALID`);
    console.log(`  \u2705 Reason : ${verification.reason || "Receipt is cryptographically valid"}`);
    console.log("\n  This receipt was verified directly against the TEE contract.");
    console.log("  No oracle server or intermediary was trusted.");
  } else {
    console.log(`  \u274c STATUS : INVALID`);
    console.log(`  \u274c Reason : ${verification.reason || "Receipt failed verification"}`);
  }

  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║  Verification performed entirely on T3N ledger  ║");
  console.log("╚══════════════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("[Verify] Fatal error:", err);
  process.exit(1);
});
