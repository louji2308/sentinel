import { Router } from "express";
import { updateAgentStatus, getAgent, registerAgent } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";

const router = Router();

router.post("/register-agent", (req, res) => {
  try {
    const { agentDid, credentialType, credentialScope } = req.body;

    if (!agentDid || !credentialType) {
      return res.status(400).json({ error: "agentDid and credentialType are required" });
    }

    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    registerAgent(agentDid, {
      did: agentDid,
      credentialScope: credentialScope || [],
      credentialStatus: "active",
      credentialType,
      issuedAt: now,
      expiresAt: now + 30 * day,
    });

    res.json({ success: true, agentDid, status: "active" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/revoke", (req, res) => {
  try {
    const { agentDid, reason } = req.body;

    if (!agentDid) {
      return res.status(400).json({ error: "agentDid is required" });
    }

    const agent = getAgent(agentDid);
    if (!agent) {
      return res.status(404).json({ error: `Agent ${agentDid} not found` });
    }

    const success = updateAgentStatus(agentDid, "revoked");
    if (!success) {
      return res.status(500).json({ error: "Failed to revoke agent" });
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

    res.json({
      success: true,
      agentDid,
      status: "revoked",
      reason: reason || "Revoked by administrator",
      timestamp: Date.now(),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;