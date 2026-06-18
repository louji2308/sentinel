import { Router } from "express";
import { updateAgentStatus, getAgent } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";

const router = Router();

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