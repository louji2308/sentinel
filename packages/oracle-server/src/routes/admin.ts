import { Router } from "express";
import { z } from "zod";
import { callContractWithAdmin } from "../services/sentinelContract.js";
import { registerAgent, getAgent, updateAgentStatus, getAllAgents } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";
import db, { recordSpend } from "../services/db.js";
import { notifyEscalation, notifySlack } from "../services/webhooks.js";

const RegisterSchema = z.object({
  agentDid: z.string().min(1),
  credentialType: z.string().min(1),
  credentialScope: z.array(z.string()).optional(),
});

const RevokeSchema = z.object({
  agentDid: z.string().min(1),
  reason: z.string().optional(),
});

const SeedPolicySchema = z.object({
  agentType: z.string().min(1),
  policyText: z.string().min(1),
});

const ResolveAdminSchema = z.object({
  escalationId: z.string().min(1),
  decision: z.enum(["APPROVE", "DENY"]),
  reason: z.string().optional(),
});

const router = Router();

router.post("/register-agent", async (req, res) => {
  try {
    const { agentDid, credentialType, credentialScope } = RegisterSchema.parse(req.body);

    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    // Always register locally first
    registerAgent(agentDid, {
      did: agentDid,
      credentialScope: credentialScope || [],
      credentialStatus: "active",
      credentialType,
      issuedAt: now,
      expiresAt: now + 30 * day,
    });

    // Try the contract
    const contractResult = await callContractWithAdmin("register-agent", {
      agentDid,
      agentType: credentialType,
      scope: credentialScope || [],
      issuedAt: now,
      expiresAt: now + 30 * day,
    });

    if (!contractResult.ok) {
      console.warn(`[Admin] register-agent contract call failed (${contractResult.error}) — using local only`);
    }

    res.json({
      success: true,
      agentDid,
      status: "active",
      storage: contractResult.ok ? "contract+local" : "local",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.post("/revoke", async (req, res) => {
  try {
    const { agentDid, reason } = RevokeSchema.parse(req.body);

    // Always update locally first
    const localSuccess = updateAgentStatus(agentDid, "revoked");
    if (!localSuccess) {
      return res.status(404).json({ error: `Agent ${agentDid} not found locally` });
    }

    appendEntry({
      id: `admin-${Date.now()}`,
      timestamp: Date.now(),
      agentDid,
      decision: "DENY",
      policyClause: "admin-revocation",
      action: { type: "admin_revoke", resource: agentDid },
      receiptId: `revoke-${Date.now()}`,
      operatorAction: "revoked",
    });

    // Try the contract
    const contractResult = await callContractWithAdmin("revoke-agent", {
      targetAgentDid: agentDid,
      operatorDid: "did:t3n:admin-operator",
      reason: reason || "Revoked by administrator",
    });

    if (!contractResult.ok) {
      console.warn(`[Admin] revoke-agent contract call failed (${contractResult.error}) — using local only`);
    }

    res.json({
      success: true,
      agentDid,
      status: "revoked",
      reason: reason || "Revoked by administrator",
      timestamp: Date.now(),
      storage: contractResult.ok ? "contract+local" : "local",
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.post("/seed-policy", async (req, res) => {
  try {
    const { agentType, policyText } = SeedPolicySchema.parse(req.body);

    const contractResult = await callContractWithAdmin("seed-policy", {
      agentType,
      policyText,
    });

    if (!contractResult.ok) {
      console.warn(`[Admin] seed-policy contract call failed (${contractResult.error}) — local only`);
    }

    res.json({
      success: true,
      agentType,
      storage: contractResult.ok ? "contract" : "local-only",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/resolve-escalation", async (req, res) => {
  try {
    const { escalationId, decision, reason } = ResolveAdminSchema.parse(req.body);

    appendEntry({
      id: `res-${escalationId}`,
      timestamp: Date.now(),
      agentDid: "operator",
      decision: `ESCALATION_${decision}`,
      policyClause: `escalation_resolved:${escalationId}`,
      action: { type: "resolve_escalation", resource: escalationId },
      receiptId: `res-${escalationId}`,
      operatorAction: decision === "APPROVE" ? "approved" : "denied",
    });

    if (decision === "APPROVE") {
      const escRow = db.prepare("SELECT agent_did, amount, request_id FROM escalations WHERE escalation_id = ?").get(escalationId) as any;
      if (escRow?.amount) {
        recordSpend(escRow.agent_did, escRow.amount, Date.now(), "daily");
        recordSpend(escRow.agent_did, escRow.amount, Date.now(), "hourly");
        recordSpend(escRow.agent_did, escRow.amount, Date.now(), "weekly");
      }
    }

    notifyEscalation({
      eventType: "escalation.resolved",
      escalationId,
      agentDid: escalationId,
      requestId: escalationId,
      amount: 0,
      reason: reason || "Resolved by operator",
      status: decision === "APPROVE" ? "approved" : "denied",
      createdAt: Date.now(),
      resolvedAt: Date.now(),
      resolution: decision,
      resolvedBy: "operator",
      dashboardUrl: "http://localhost:3000/governance",
    }).catch(() => {});
    notifySlack({
      eventType: "escalation.resolved",
      escalationId,
      agentDid: escalationId,
      requestId: escalationId,
      amount: 0,
      reason: reason || "Resolved by operator",
      status: decision === "APPROVE" ? "approved" : "denied",
      createdAt: Date.now(),
      resolvedAt: Date.now(),
      resolution: decision,
      resolvedBy: "operator",
      dashboardUrl: "http://localhost:3000/governance",
    }).catch(() => {});

    const contractResult = await callContractWithAdmin("resolve-escalation", {
      escalationId,
      decision,
      operatorDid: "did:t3n:admin-operator",
      reason: reason || "Resolved by operator",
    });

    if (!contractResult.ok) {
      console.warn(`[Admin] resolve-escalation contract call failed (${contractResult.error}) — using local only`);
    }

    res.json({
      success: true,
      escalationId,
      decision,
      storage: contractResult.ok ? "contract+local" : "local",
      contractResult: contractResult.ok ? contractResult.data : undefined,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
