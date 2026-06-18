const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001";

export interface VerdictEntry {
  requestId: string;
  decision: "PERMIT" | "DENY" | "ESCALATE";
  reason: string;
  receipt: {
    receiptId: string;
    policyClause: string;
    policyHash: string;
    issuedAt: number;
  };
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  agentDid: string;
  decision: string;
  policyClause: string;
  action: { type: string; resource: string };
  receiptId: string;
}

export interface AgentInfo {
  did: string;
  credentialType: string;
  credentialStatus: string;
}

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const res = await fetch(`${ORACLE_URL}/api/audit/stream`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch audit log");
  const data = await res.json();
  return data.entries;
}

export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${ORACLE_URL}/api/audit/agents`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch agents");
  const data = await res.json();
  return data.agents;
}

export async function fetchReceipt(receiptId: string) {
  const res = await fetch(`${ORACLE_URL}/api/audit/receipt/${receiptId}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Receipt not found");
  return res.json();
}

export async function revokeAgent(agentDid: string, reason?: string) {
  const res = await fetch(`${ORACLE_URL}/api/admin/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentDid, reason }),
  });
  if (!res.ok) throw new Error("Failed to revoke agent");
  return res.json();
}