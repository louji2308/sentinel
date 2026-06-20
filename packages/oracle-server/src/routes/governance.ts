import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import db, { getPendingProposals, getPendingEscalations, recordSpend } from "../services/db.js";
import { appendEntry } from "../services/auditLog.js";
import { notifyEscalation, notifySlack } from "../services/webhooks.js";

const router = Router();

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

const ProposalSchema = z.object({
  action: z.string().min(1),
  targetId: z.string().min(1),
  decision: z.enum(["APPROVE", "DENY"]).optional().default("APPROVE"),
  requiredVotes: z.number().int().positive().optional().default(2),
});

const VoteSchema = z.object({
  operatorDid: z.string().min(1),
  approve: z.boolean(),
});

const ResolveSchema = z.object({
  decision: z.enum(["APPROVE", "DENY"]),
  reason: z.string().optional(),
});

router.get("/proposals", (_req, res) => {
  try {
    res.json(getPendingProposals());
  } catch (err: any) {
    res.status(500).json({ error: err.message, proposals: [] });
  }
});

router.post("/proposals", (req, res) => {
  try {
    const data = ProposalSchema.parse(req.body);
    const proposal = {
      proposalId: generateId("PROP"),
      action: data.action,
      targetId: data.targetId,
      decision: data.decision,
      requiredVotes: data.requiredVotes,
      votes: [],
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7,
    };
    db.prepare(`
      INSERT INTO proposals (proposal_id, action, target_id, decision, required_votes, votes, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(proposal.proposalId, proposal.action, proposal.targetId, proposal.decision,
           proposal.requiredVotes, JSON.stringify(proposal.votes), proposal.status,
           proposal.createdAt, proposal.expiresAt);
    res.json(proposal);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.post("/proposals/:id/vote", (req, res) => {
  try {
    const { id } = req.params;
    const { operatorDid, approve } = VoteSchema.parse(req.body);

    const row = db.prepare("SELECT * FROM proposals WHERE proposal_id = ?").get(id) as any;
    if (!row) return res.status(404).json({ error: "Proposal not found" });
    if (row.status !== "pending") return res.status(400).json({ error: "Proposal already resolved" });

    const votes = JSON.parse(row.votes) as { operator: string; approve: boolean }[];
    if (votes.some(v => v.operator === operatorDid)) {
      return res.status(409).json({ error: "Operator already voted" });
    }

    votes.push({ operator: operatorDid, approve });

    const approveCount = votes.filter(v => v.approve).length;
    const rejectCount = votes.filter(v => !v.approve).length;
    let status = "pending";
    if (approveCount >= row.required_votes) status = "executed";
    else if (rejectCount >= row.required_votes) status = "rejected";

    db.prepare("UPDATE proposals SET votes = ?, status = ? WHERE proposal_id = ?")
      .run(JSON.stringify(votes), status, id);

    res.json({ proposalId: id, votes, status, approveCount, rejectCount });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.get("/escalations", (_req, res) => {
  try {
    res.json(getPendingEscalations());
  } catch (err: any) {
    res.status(500).json({ error: err.message, escalations: [] });
  }
});

router.post("/escalations/:id/resolve", (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reason } = ResolveSchema.parse(req.body);

    const status = decision === "APPROVE" ? "approved" : "denied";
    const now = Date.now();
    const result = db.prepare(
      "UPDATE escalations SET status = ?, resolved_at = ?, resolution = ?, resolved_by = ? WHERE escalation_id = ? AND status = 'pending'"
    ).run(status, now, reason || "Resolved via governance", "governance", id);
    if (result.changes === 0) return res.status(404).json({ error: "Escalation not found or already resolved" });

    if (decision === "APPROVE") {
      const escRow = db.prepare("SELECT agent_did, amount FROM escalations WHERE escalation_id = ?").get(id) as any;
      if (escRow?.amount) {
        recordSpend(escRow.agent_did, escRow.amount, now, "daily");
        recordSpend(escRow.agent_did, escRow.amount, now, "hourly");
        recordSpend(escRow.agent_did, escRow.amount, now, "weekly");
      }
    }

    appendEntry({
      id: `gov-resolve-${id}`,
      timestamp: now,
      agentDid: "governance",
      decision: `ESCALATION_${decision}`,
      policyClause: `governance_resolved:${id}=${decision}`,
      action: { type: "governance_resolve", resource: id },
      receiptId: `gov-${id}`,
    });

    notifyEscalation({
      eventType: "escalation.resolved",
      escalationId: id,
      agentDid: id,
      requestId: id,
      amount: 0,
      reason: reason || "Resolved via governance",
      status,
      createdAt: now,
      resolvedAt: now,
      resolution: decision,
      resolvedBy: "governance",
      dashboardUrl: "http://localhost:3000/governance",
    }).catch(() => {});
    notifySlack({
      eventType: "escalation.resolved",
      escalationId: id,
      agentDid: id,
      requestId: id,
      amount: 0,
      reason: reason || "Resolved via governance",
      status,
      createdAt: now,
      resolvedAt: now,
      resolution: decision,
      resolvedBy: "governance",
      dashboardUrl: "http://localhost:3000/governance",
    }).catch(() => {});

    res.json({ escalationId: id, status, resolved: true });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: "Validation failed", details: err.errors });
    res.status(500).json({ error: err.message });
  }
});

export default router;
