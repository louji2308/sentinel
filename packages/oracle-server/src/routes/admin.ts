import { Router } from "express";
import { callContractWithAdmin } from "../services/sentinelContract.js";
import { registerAgent, getAgent, updateAgentStatus, getAllAgents } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";

const router = Router();

router.post("/register-agent", async (req, res) => {
  try {
    const { agentDid, credentialType, credentialScope } = req.body;

    if (!agentDid || !credentialType) {
      return res.status(400).json({ error: "agentDid and credentialType are required" });
    }

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
    res.status(500).json({ error: err.message });
  }
});

router.post("/revoke", async (req, res) => {
  try {
    const { agentDid, reason } = req.body;

    if (!agentDid) {
      return res.status(400).json({ error: "agentDid is required" });
    }

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
    res.status(500).json({ error: err.message });
  }
});

router.post("/seed-policy", async (req, res) => {
  try {
    const { agentType, policyText } = req.body;

    if (!agentType || !policyText) {
      return res.status(400).json({ error: "agentType and policyText are required" });
    }

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
    const { escalationId, decision, reason } = req.body;

    if (!escalationId || !decision) {
      return res.status(400).json({ error: "escalationId and decision are required" });
    }

    const normalized = decision.toUpperCase();
    if (normalized !== "APPROVE" && normalized !== "DENY") {
      return res.status(400).json({ error: "decision must be APPROVE or DENY" });
    }

    // Record locally
    appendEntry({
      id: `res-${escalationId}`,
      timestamp: Date.now(),
      agentDid: "operator",
      decision: `ESCALATION_${normalized}`,
      policyClause: `escalation_resolved:${escalationId}`,
      action: { type: "resolve_escalation", resource: escalationId },
      receiptId: `res-${escalationId}`,
      operatorAction: normalized === "APPROVE" ? "approved" : "denied",
    });

    // Try the contract
    const contractResult = await callContractWithAdmin("resolve-escalation", {
      escalationId,
      decision: normalized,
      operatorDid: "did:t3n:admin-operator",
      reason: reason || "Resolved by operator",
    });

    if (!contractResult.ok) {
      console.warn(`[Admin] resolve-escalation contract call failed (${contractResult.error}) — using local only`);
    }

    res.json({
      success: true,
      escalationId,
      decision: normalized,
      storage: contractResult.ok ? "contract+local" : "local",
      contractResult: contractResult.ok ? contractResult.data : undefined,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
