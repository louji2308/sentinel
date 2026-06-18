import "dotenv/config";
import { createAuthenticatedClient } from "@sentinel/t3-client";

const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001";

export async function requestCompliance(agentDid: string, action: string, resource: string, amount?: number, metadata?: Record<string, unknown>) {
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

  return res.json();
}

export async function registerWithOracle(agentDid: string) {
  const res = await fetch(`${ORACLE_URL}/api/admin/register-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentDid }),
  });
  if (!res.ok && res.status !== 409) {
    console.warn(`[Register] Warning: ${res.status}`);
  }
  return res.ok ? res.json() : null;
}

export async function authenticateAgent(privateKey: string, env: "testnet" | "production" = "testnet") {
  return createAuthenticatedClient(privateKey, env);
}

export function logResult(label: string, result: any) {
  const emoji = result.decision === "PERMIT" ? "✅" : result.decision === "ESCALATE" ? "⚠️" : "❌";
  console.log(`${emoji} [${label}] ${result.decision}: ${result.reason}`);
}
