import { Router } from "express";
import { callContractWithAdmin, callContract } from "../services/sentinelContract.js";

const router = Router();

router.post("/register-agent", async (req, res) => {
  try {
    const { agentDid, credentialType, credentialScope } = req.body;

    if (!agentDid || !credentialType) {
      return res.status(400).json({ error: "agentDid and credentialType are required" });
    }

    const now = Math.floor(Date.now() / 1000);
    const day = 86400;

    const result = await callContractWithAdmin("register-agent", {
      agentDid,
      agentType: credentialType,
      scope: credentialScope || [],
      issuedAt: now,
      expiresAt: now + 30 * day,
    });

    res.json({ success: true, agentDid, status: "active", contractResult: result });
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

    const result = await callContractWithAdmin("revoke-agent", {
      targetAgentDid: agentDid,
      operatorDid: "did:t3n:admin-operator",
      reason: reason || "Revoked by administrator",
    });

    res.json({
      success: true,
      agentDid,
      status: "revoked",
      reason: reason || "Revoked by administrator",
      timestamp: Date.now(),
      contractResult: result,
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

    const result = await callContractWithAdmin("seed-policy", {
      agentType,
      policyText,
    });

    res.json({ success: true, agentType, contractResult: result });
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

    const result = await callContractWithAdmin("resolve-escalation", {
      escalationId,
      decision: normalized,
      operatorDid: "did:t3n:admin-operator",
      reason: reason || `Resolved by operator`,
    });

    res.json({ success: true, escalationId, decision: normalized, contractResult: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
