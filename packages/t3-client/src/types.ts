export type VerdictDecision = "PERMIT" | "DENY" | "ESCALATE" | "ESCALATION_DENY" | "ESCALATION_APPROVE";

export interface AgentIdentity {
  did: string;
  credentialScope: string[];
  credentialStatus: "active" | "revoked" | "suspended";
  credentialType: string;
  issuedAt: number;
  expiresAt: number;
}

export interface ProposedAction {
  type: string;
  resource: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface VerdictRequest {
  agentDid: string;
  proposedAction: ProposedAction;
  requestId: string;
  timestamp: number;
}

export interface ComplianceReceipt {
  receiptId: string;
  agentDid: string;
  decision: VerdictDecision;
  policyHash: string;
  policyClause: string;
  ledgerCursor: string;
  issuedAt: number;
  expiresAt: number;
  signature: string;
  action: ProposedAction;
}

export interface VerdictResponse {
  requestId: string;
  decision: VerdictDecision;
  receipt: ComplianceReceipt;
  reason: string;
  escalationId?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  agentDid: string;
  decision: VerdictDecision;
  policyClause: string;
  action: ProposedAction;
  receiptId: string;
  operatorAction?: "revoked" | "approved" | "denied";
}