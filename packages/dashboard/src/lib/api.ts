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

export interface ProposalInfo {
  proposalId: string;
  action: string;
  targetId: string;
  decision: string;
  requiredVotes: number;
  votes: { operator: string; approve: boolean }[];
  status: string;
  createdAt: number;
}

export interface VelocityInfo {
  agentDid: string;
  windows: { hourly: number; daily: number; weekly: number; hourly_count: number; daily_count: number; weekly_count: number };
  cap: number;
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
  return data.agents || [];
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
  const res = await fetch(`${ORACLE_URL}/api/governance/escalations/${encodeURIComponent(escalationId)}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
  if (!res.ok) throw new Error("Failed to resolve escalation");
  return res.json();
}

export async function fetchEscalations(): Promise<EscalationInfo[]> {
  const res = await fetch(`${ORACLE_URL}/api/governance/escalations`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data || [];
}

export async function fetchProposals(): Promise<ProposalInfo[]> {
  const res = await fetch(`${ORACLE_URL}/api/governance/proposals`, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data || [];
}

export async function voteProposal(proposalId: string, operatorDid: string, approve: boolean) {
  const res = await fetch(`${ORACLE_URL}/api/governance/proposals/${encodeURIComponent(proposalId)}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operatorDid, approve }),
  });
  if (!res.ok) throw new Error("Failed to vote");
  return res.json();
}

export async function createProposal(action: string, targetId: string, requiredVotes?: number) {
  const res = await fetch(`${ORACLE_URL}/api/governance/proposals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, targetId, requiredVotes }),
  });
  if (!res.ok) throw new Error("Failed to create proposal");
  return res.json();
}

export async function fetchVelocity(agentDid: string): Promise<VelocityInfo | null> {
  try {
    const res = await fetch(`${ORACLE_URL}/api/audit/velocity/${encodeURIComponent(agentDid)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function fetchHealth(): Promise<{ mode: string; storage: string } | null> {
  try {
    const res = await fetch(`${ORACLE_URL}/api/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}
