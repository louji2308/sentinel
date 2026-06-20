import "dotenv/config";
import { createAuthenticatedClient, createTenantClient } from "@sentinel/t3-client";
import { getNodeUrl } from "@terminal3/t3n-sdk";

const CONTRACT_TAIL    = process.env.CONTRACT_TAIL    || "sentinel-compliance-oracle";
const CONTRACT_VERSION = process.env.CONTRACT_VERSION || "1.0.0";
const ORACLE_URL       = process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001";

export async function verifyReceiptDirect(receiptId: string, agentDid: string): Promise<{
  valid: boolean;
  reason: string;
  source: "tee-contract" | "oracle-fallback";
}> {
  try {
    const apiKey = process.env.T3N_API_KEY;
    if (apiKey && process.env.SENTINEL_TENANT_DID) {
      const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
      const baseUrl = process.env.T3N_BASE_URL || getNodeUrl();
      const auth = await createAuthenticatedClient(apiKey, environment);
      const tc = await createTenantClient(auth, process.env.SENTINEL_TENANT_DID, baseUrl);

      const result = await tc.contracts.execute(CONTRACT_TAIL, {
        version: CONTRACT_VERSION,
        functionName: "verify-receipt",
        input: { receiptId, agentDid },
      }) as { valid: boolean; reason: string };

      return { ...result, source: "tee-contract" };
    }
  } catch {}

  const res = await fetch(`${ORACLE_URL}/api/audit/receipt/${encodeURIComponent(receiptId)}?agentDid=${encodeURIComponent(agentDid)}`);
  if (!res.ok) {
    return { valid: false, reason: "Receipt not found", source: "oracle-fallback" };
  }
  const data = await res.json();
  return {
    valid: data.verification?.valid ?? false,
    reason: data.verification?.reason ?? "Unknown",
    source: "oracle-fallback",
  };
}

export class ReceiptWallet {
  private receipts: Map<string, { receiptId: string; decision: string; timestamp: number; policyClause: string }> = new Map();

  store(receiptId: string, decision: string, policyClause: string): void {
    this.receipts.set(receiptId, { receiptId, decision, timestamp: Date.now(), policyClause });
  }

  async verify(receiptId: string, agentDid: string): Promise<boolean> {
    const result = await verifyReceiptDirect(receiptId, agentDid);
    console.log(`  \u{1F4DC} Receipt ${receiptId}: ${result.valid ? "\u2705 VALID" : "\u274c INVALID"} (via ${result.source})`);
    return result.valid;
  }

  exportSummary(): Record<string, unknown> {
    return {
      totalReceipts: this.receipts.size,
      decisions: Object.fromEntries(
        ["PERMIT", "DENY", "ESCALATE"].map(d => [d, Array.from(this.receipts.values()).filter(r => r.decision === d).length])
      ),
      receipts: Array.from(this.receipts.values()),
    };
  }
}
