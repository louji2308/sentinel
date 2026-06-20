/**
 * Policy What-If Simulator
 *
 * Allows operators to test policy changes before deploying them to the TEE contract.
 * This runs the TypeScript Cedar engine (same logic as before) but is explicitly
 * labeled as a simulation — it does NOT produce authoritative TEE-signed receipts.
 *
 * Results include a disclaimer that this is a dry run, not an actual compliance decision.
 */

import { evaluatePolicy } from "./engine.js";

export interface DryRunInput {
  agentType: string;
  credentialStatus: string;
  action: string;
  resourceType: string;
  resourceDomain: string;
  amount?: number;
}

export interface DryRunResult {
  decision: "PERMIT" | "DENY" | "ESCALATE";
  matchedPolicyId: string;
  reason: string;
  simulation: true;
  disclaimer: string;
}

export async function runDryRun(input: DryRunInput): Promise<DryRunResult> {
  const principal = {
    did: `did:t3n:simulation-${Date.now()}`,
    credentialStatus: input.credentialStatus as "active" | "revoked" | "suspended",
    credentialType: input.agentType,
    spendCap: 1000000,
    credentialExpiresAt: Date.now() + 86400000,
  };

  const resource = {
    type: input.resourceType,
    domain: input.resourceDomain,
    amount: input.amount,
  };

  const now = new Date();
  const context = {
    hourOfDay: now.getUTCHours(),
    dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getUTCDay()],
    currentTimestamp: Math.floor(now.getTime() / 1000),
    requestId: `sim-${Date.now()}`,
  };

  const result = await evaluatePolicy(principal, input.action, resource, context);

  return {
    decision: result.decision as "PERMIT" | "DENY" | "ESCALATE",
    matchedPolicyId: result.matchedPolicyId,
    reason: result.reason,
    simulation: true,
    disclaimer:
      "This is a SIMULATION only. Results are produced by a local TypeScript policy engine, " +
      "not by the TEE contract. This does not produce an authoritative, cryptographically " +
      "signed receipt. Use this tool to test policy changes before deploying them to the contract.",
  };
}
