import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { callContract } from "../services/sentinelContract.js";
import { evaluatePolicy } from "@sentinel/policy-engine";
import { getAgent } from "../services/agentRegistry.js";
import { appendEntry } from "../services/auditLog.js";
import { getCumulativeSpend, recordSpendBatch, insertEscalation, getCachedResponse, setCachedResponse, upsertReceipt } from "../services/db.js";
import { notifyEscalation, notifySlack, getDashboardUrl } from "../services/webhooks.js";

const CheckSchema = z.object({
  agentDid: z.string().min(1),
  proposedAction: z.object({
    type: z.string().min(1),
    resource: z.string().min(1),
    amount: z.number().nonnegative().optional(),
    currency: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  requestId: z.string().min(1),
  timestamp: z.number().optional(),
});

function parseSpendCap(scope: string[]): number {
  for (const s of scope) {
    if (s.startsWith("spend:")) {
      const cap = s.slice(6);
      if (cap === "unlimited") return Infinity;
      const n = parseInt(cap, 10);
      if (!isNaN(n)) return n;
    }
  }
  return 1000;
}

const router = Router();

router.post("/check", async (req, res, next) => {
  try {
    const parsed = CheckSchema.parse(req.body);
    const { agentDid, proposedAction, requestId, timestamp } = parsed;

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

    const spendCap = parseSpendCap(agent.credentialScope);
    const principal = {
      did: agent.did,
      credentialStatus: agent.credentialStatus,
      credentialType: agent.credentialType,
      spendCap,
      credentialExpiresAt: agent.expiresAt,
    };

    const resource = {
      type: proposedAction.resource || "GenericResource",
      domain: (proposedAction.metadata?.domain as string) || "unknown",
      amount: proposedAction.amount,
    };

    const now = Date.now();
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

    // Request deduplication: return cached result for identical requestId
    const cached = getCachedResponse(requestId);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

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

    // Persist receipt for later verification
    upsertReceipt({
      receiptId,
      agentDid,
      decision: policyResult.decision,
      policyHash: policyResult.policyHash,
      policyClause: policyResult.matchedPolicyId,
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      signature: receipt.signature,
    });

    if (policyResult.decision === "PERMIT" && proposedAction.amount) {
      recordSpendBatch(agentDid, proposedAction.amount, now);
    }

    if (policyResult.decision === "ESCALATE") {
      const escalationId = `ESC-${requestId.slice(0, 8)}`;
      insertEscalation({
        escalationId,
        agentDid,
        requestId,
        action: proposedAction,
        amount: proposedAction.amount || 0,
        reason: policyResult.reason,
      });
      notifyEscalation({
        eventType: "escalation.created",
        escalationId,
        agentDid,
        requestId,
        amount: proposedAction.amount || 0,
        reason: policyResult.reason,
        status: "pending",
        createdAt: Date.now(),
        dashboardUrl: `${getDashboardUrl()}/governance`,
      }).catch(() => {});
      notifySlack({
        eventType: "escalation.created",
        escalationId,
        agentDid,
        requestId,
        amount: proposedAction.amount || 0,
        reason: policyResult.reason,
        status: "pending",
        createdAt: Date.now(),
        dashboardUrl: `${getDashboardUrl()}/governance`,
      }).catch(() => {});
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

    const response = {
      requestId,
      decision: policyResult.decision,
      receipt,
      reason: policyResult.reason,
      escalationId: policyResult.decision === "ESCALATE" ? `ESC-${requestId.slice(0, 8)}` : undefined,
    };

    // Cache for idempotent replay protection
    setCachedResponse(requestId, JSON.stringify(response));

    res.json(response);
  } catch (err: unknown) {
    next(err);
  }
});

export default router;
