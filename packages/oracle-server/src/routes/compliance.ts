import { Router } from "express";
import crypto from "crypto";
import { evaluatePolicy } from "@sentinel/policy-engine";
import { getAgent } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";

const router = Router();

router.post("/check", async (req, res) => {
  try {
    const { agentDid, proposedAction, requestId, timestamp } = req.body;

    if (!agentDid || !proposedAction || !requestId) {
      return res.status(400).json({ error: "Missing required fields: agentDid, proposedAction, requestId" });
    }

    const agent = getAgent(agentDid);
    if (!agent) {
      return res.status(404).json({ error: `Agent ${agentDid} not registered`, requestId });
    }

    const principal = {
      did: agent.did,
      credentialStatus: agent.credentialStatus,
      credentialType: agent.credentialType,
      spendCap: 10000,
      credentialExpiresAt: agent.expiresAt,
    };

    const resource = {
      type: proposedAction.resource || "GenericResource",
      domain: proposedAction.metadata?.domain || "unknown",
      amount: proposedAction.amount,
    };

    const now = new Date();
    const context = {
      hourOfDay: now.getUTCHours(),
      dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][now.getUTCDay()],
      currentTimestamp: Math.floor(now.getTime() / 1000),
      requestId,
    };

    const policyResult = await evaluatePolicy(principal, proposedAction.type, resource, context);

    const receiptId = `rcpt-${crypto.randomBytes(8).toString("hex")}`;
    const receipt = {
      receiptId,
      agentDid,
      decision: policyResult.decision,
      policyHash: policyResult.policyHash,
      policyClause: policyResult.matchedPolicyId,
      ledgerCursor: `cursor-${Date.now()}`,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      signature: `sig-${crypto.createHash("sha256").update(receiptId + policyResult.policyHash).digest("hex")}`,
      action: proposedAction,
    };

    appendEntry({
      id: `log-${crypto.randomBytes(4).toString("hex")}`,
      timestamp: Date.now(),
      agentDid,
      decision: policyResult.decision,
      policyClause: policyResult.matchedPolicyId,
      action: proposedAction,
      receiptId,
    });

    res.json({
      requestId,
      decision: policyResult.decision,
      receipt,
      reason: policyResult.reason,
    });
  } catch (err: any) {
    console.error("[Compliance] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;