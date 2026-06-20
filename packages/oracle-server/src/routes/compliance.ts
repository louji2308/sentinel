import { Router } from "express";
import crypto from "crypto";
import { callContract } from "../services/sentinelContract.js";
import { evaluatePolicy } from "@sentinel/policy-engine";
import { getAgent } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";
import { getCumulativeSpend, recordSpend, insertEscalation } from "../services/db.js";

const router = Router();

router.post("/check", async (req, res) => {
  try {
    const { agentDid, proposedAction, requestId, timestamp } = req.body;

    if (!agentDid || !proposedAction || !requestId) {
      return res.status(400).json({ error: "Missing required fields: agentDid, proposedAction, requestId" });
    }

    // First, try the TEE contract
    const contractResult = await callContract("evaluate-compliance", {
      agentDid,
      action: {
        type: proposedAction.type,
        resource: proposedAction.resource,
        amount: proposedAction.amount,
        currency: proposedAction.currency,
        metadata: proposedAction.metadata ?? {},
      },
      requestId,
      timestamp: timestamp ?? Math.floor(Date.now() / 1000),
    });

    if (contractResult.ok) {
      const data = contractResult.data as any;
      const escalationId = data.escalationId;
      if (escalationId) {
        appendEntry({
          id: `esc-${Date.now()}`,
          timestamp: Date.now(),
          agentDid,
          decision: "ESCALATE",
          policyClause: data.receipt?.policyClause || "escalation",
          action: proposedAction,
          receiptId: data.receipt?.receiptId || `RCP-${requestId}`,
        });
      }
      return res.json(data);
    }

    // Fallback: local policy engine
    console.warn(`[Compliance] Contract unavailable (${contractResult.error}), using local engine`);

    const agent = getAgent(agentDid);
    if (!agent) {
      return res.status(404).json({ error: `Agent ${agentDid} not registered`, requestId });
    }

    const principal = {
      did: agent.did,
      credentialStatus: agent.credentialStatus,
      credentialType: agent.credentialType,
      spendCap: agent.expiresAt ? 10000 : 1000,
      credentialExpiresAt: agent.expiresAt,
    };

    const resource = {
      type: proposedAction.resource || "GenericResource",
      domain: proposedAction.metadata?.domain || "unknown",
      amount: proposedAction.amount,
    };

    const now = Date.now();
    const spendCap = principal.spendCap;
    const spendHourly = getCumulativeSpend(agentDid, now, "hourly");
    const spendDaily = getCumulativeSpend(agentDid, now, "daily");

    const context = {
      hourOfDay: new Date(now).getUTCHours(),
      dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(now).getUTCDay()],
      currentTimestamp: Math.floor(now / 1000),
      requestId,
      spendDaily,
      spendHourly,
      spendCap,
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

    if (policyResult.decision === "PERMIT" && proposedAction.amount) {
      recordSpend(agentDid, proposedAction.amount, now, "daily");
      recordSpend(agentDid, proposedAction.amount, now, "hourly");
      recordSpend(agentDid, proposedAction.amount, now, "weekly");
    }

    if (policyResult.decision === "ESCALATE") {
      insertEscalation({
        escalationId: `ESC-${requestId.slice(0, 8)}`,
        agentDid,
        requestId,
        action: proposedAction,
        amount: proposedAction.amount || 0,
        reason: policyResult.reason,
      });
    }

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
      escalationId: policyResult.decision === "ESCALATE" ? `ESC-${requestId.slice(0, 8)}` : undefined,
    });
  } catch (err: any) {
    console.error("[Compliance] Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
