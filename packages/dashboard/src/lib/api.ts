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
    signature: string;
  };
  escalationId?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  agentDid: string;
  decision: string;
  policyClause: string;
  action: { type: string; resource: string; amount?: number };
  receiptId: string;
}

export interface AgentInfo {
  did: string;
  credentialType: string;
  credentialStatus: string;
}

export interface EscalationInfo {
  escalationId: string;
  agentDid: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: number;
}

export async function fetchAuditLog(): Promise<{ entries: AuditEntry[]; cursor: string }> {
  const res = await fetch(`${ORACLE_URL}/api/audit/stream?since=0`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch audit log");
  return res.json();
}

export async function fetchAgents(): Promise<AgentInfo[]> {
  const res = await fetch(`${ORACLE_URL}/api/audit/agents`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch agents");
  const data = await res.json();
  return data.agents;
}

export async function fetchReceipt(receiptId: string) {
  const res = await fetch(`${ORACLE_URL}/api/audit/receipt/${receiptId}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error("Receipt verification failed");
  }
  return res.json();
}

export async function exportAuditLog(): Promise<void> {
  const res = await fetch(`${ORACLE_URL}/api/audit/export`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to export audit log");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = `sentinel-audit-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

export async function registerAgent(agentDid: string, credentialType: string, credentialScope?: string[]) {
  const res = await fetch(`${ORACLE_URL}/api/admin/register-agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentDid, credentialType, credentialScope }),
  });
  if (!res.ok) throw new Error("Failed to register agent");
  return res.json();
}

export async function resolveEscalation(escalationId: string, decision: "APPROVE" | "DENY", reason?: string) {
  const res = await fetch(`${ORACLE_URL}/api/admin/resolve-escalation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ escalationId, decision, reason }),
  });
  if (!res.ok) throw new Error("Failed to resolve escalation");
  return res.json();
}
