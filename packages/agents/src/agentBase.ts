import "dotenv/config";
import { createAuthenticatedClient } from "@sentinel/t3-client";
import { ReceiptWallet } from "./receipts.js";

const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001";
export const receiptWallet = new ReceiptWallet();

export interface ComplianceResult {
  requestId: string;
  decision: "PERMIT" | "DENY" | "ESCALATE";
  receipt: any;
  reason: string;
  escalationId?: string;
}

export async function requestCompliance(
  agentDid: string,
  action: string,
  resource: string,
  amount?: number,
  metadata?: Record<string, unknown>
): Promise<ComplianceResult> {
  const body = {
    agentDid,
    proposedAction: { type: action, resource, amount, metadata: metadata || {} },
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Math.floor(Date.now() / 1000),
  };

  const res = await fetch(`${ORACLE_URL}/api/compliance/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Compliance check failed (${res.status}): ${err}`);
  }

  const result: ComplianceResult = await res.json();

  if (result.receipt?.receiptId) {
    receiptWallet.store(
      result.receipt.receiptId,
      result.decision,
      result.receipt.policyClause || result.receipt.policyClause || ""
    );
  }

  return result;
}

export async function registerWithOracle(agentDid: string, credentialType?: string) {
  const res = await fetch(`${ORACLE_URL}/api/admin/register-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentDid, credentialType: credentialType || "generic" }),
  });
  if (!res.ok && res.status !== 409) {
    console.warn(`[Register] Warning: ${res.status}`);
  }
  return res.ok ? res.json() : null;
}

export async function resolveEscalation(
  escalationId: string,
  decision: "APPROVE" | "DENY",
  reason?: string
) {
  const res = await fetch(`${ORACLE_URL}/api/governance/escalations/${encodeURIComponent(escalationId)}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Escalation resolution failed (${res.status}): ${err}`);
  }
  return res.json();
}

export async function authenticateAgent(privateKey: string, env: "testnet" | "production" = "testnet") {
  return createAuthenticatedClient(privateKey, env);
}

export function logResult(label: string, result: ComplianceResult) {
  const emoji = result.decision === "PERMIT" ? "\u2705" : result.decision === "ESCALATE" ? "\u26a0\ufe0f" : "\u274c";
  console.log(`${emoji} [${label}] ${result.decision}: ${result.reason}`);
}

export async function retryWithReducedScope(
  agentDid: string,
  action: string,
  resource: string,
  originalAmount: number,
  metadata?: Record<string, unknown>
): Promise<ComplianceResult | null> {
  const reductionFactors = [0.5, 0.25, 0.1];
  for (const factor of reductionFactors) {
    const reducedAmount = Math.floor(originalAmount * factor);
    console.log(`  \u21bb Retrying with reduced amount: $${reducedAmount} (${factor * 100}%)`);
    try {
      const result = await requestCompliance(agentDid, action, resource, reducedAmount, metadata);
      if (result.decision === "PERMIT") {
        console.log(`  \u2705 Retry succeeded at $${reducedAmount}`);
        return result;
      }
      if (result.decision === "ESCALATE") {
        console.log(`  \u26a0\ufe0f Retry at $${reducedAmount} still needs escalation`);
      }
    } catch (err: any) {
      console.warn(`  Retry failed: ${err.message}`);
    }
  }
  return null;
}

export async function pollEscalation(
  escalationId: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<"approved" | "denied" | "timeout"> {
  console.log(`  \u231b Polling escalation ${escalationId}...`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${ORACLE_URL}/api/governance/escalations`);
      if (res.ok) {
        const escalations: any[] = await res.json();
        const match = escalations.find(e => e.escalationId === escalationId);
        if (!match) return "approved";
      }
    } catch {}
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.log(`  \u23f0 Escalation ${escalationId} polling timed out`);
  return "timeout";
}

export async function verifyReceipt(receiptId: string, agentDid: string): Promise<boolean> {
  return receiptWallet.verify(receiptId, agentDid);
}
