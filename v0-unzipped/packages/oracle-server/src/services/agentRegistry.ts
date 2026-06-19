import type { AgentIdentity } from "@sentinel/t3-client";

const agents: Map<string, AgentIdentity> = new Map();

export function registerAgent(did: string, identity: AgentIdentity): void {
  agents.set(did, identity);
}

export function getAgent(did: string): AgentIdentity | undefined {
  return agents.get(did);
}

export function getAllAgents(): AgentIdentity[] {
  return Array.from(agents.values());
}

export function updateAgentStatus(did: string, status: AgentIdentity["credentialStatus"]): boolean {
  const agent = agents.get(did);
  if (!agent) return false;
  agent.credentialStatus = status;
  return true;
}