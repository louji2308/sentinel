import { upsertAgent, getAgent as dbGetAgent, getAllAgents as dbGetAllAgents, updateAgentStatus as dbUpdateStatus } from "./db.js";
import type { AgentIdentity } from "@sentinel/t3-client";

export function registerAgent(did: string, identity: AgentIdentity): void {
  upsertAgent({
    did,
    credentialType: identity.credentialType,
    credentialStatus: identity.credentialStatus,
    scope: identity.credentialScope,
    issuedAt: identity.issuedAt,
    expiresAt: identity.expiresAt,
  });
}

export function getAgent(did: string): AgentIdentity | undefined {
  const a = dbGetAgent(did);
  if (!a) return undefined;
  return {
    did: a.did,
    credentialScope: a.scope,
    credentialStatus: a.credentialStatus,
    credentialType: a.credentialType,
    issuedAt: a.issuedAt,
    expiresAt: a.expiresAt,
  };
}

export function getAllAgents(): AgentIdentity[] {
  return dbGetAllAgents().map(a => ({
    did: a.did,
    credentialScope: a.scope,
    credentialStatus: a.credentialStatus,
    credentialType: a.credentialType,
    issuedAt: a.issuedAt,
    expiresAt: a.expiresAt,
  }));
}

export function updateAgentStatus(did: string, status: AgentIdentity["credentialStatus"]): boolean {
  return dbUpdateStatus(did, status);
}

export function clearCache(): void {
  // No-op — SQLite persists intentionally
  // Call clearDb() from db.ts only in tests
}
