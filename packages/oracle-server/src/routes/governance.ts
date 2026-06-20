import { Router } from "express";
import crypto from "crypto";
import { db } from "../services/db";

const router = Router();

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString("hex")}`;
}

router.get("/proposals", (_req, res) => {
  try {
    const proposals = db.prepare("SELECT * FROM proposals ORDER BY created_at DESC LIMIT 50").all() as any[];
    res.json(proposals.map(p => ({
      proposalId: p.proposal_id,
      action: p.action,
      targetId: p.target_id,
      decision: p.decision,
      requiredVotes: p.required_votes,
      votes: JSON.parse(p.votes),
      status: p.status,
      createdAt: p.created_at,
      expiresAt: p.expires_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message, proposals: [] });
  }
});

router.post("/proposals", (req, res) => {
  try {
    const { action, targetId, decision, requiredVotes } = req.body;
    if (!action || !targetId) {
      return res.status(400).json({ error: "action and targetId required" });
    }
    const proposal = {
      proposalId: generateId("PROP"),
      action,
      targetId,
      decision: decision || "APPROVE",
      requiredVotes: requiredVotes || 2,
      votes: [],
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 7,
    };
    db.prepare(`
      INSERT INTO proposals (proposal_id, action, target_id, decision, required_votes, votes, status, created_at, expires_at)
      VALUES (@proposalId, @action, @targetId, @decision, @requiredVotes, @votes, @status, @createdAt, @expiresAt)
    `).run({
      proposalId: proposal.proposalId,
      action: proposal.action,
      targetId: proposal.targetId,
      decision: proposal.decision,
      requiredVotes: proposal.requiredVotes,
      votes: JSON.stringify(proposal.votes),
      status: proposal.status,
      createdAt: proposal.createdAt,
      expiresAt: proposal.expiresAt,
    });
    res.json(proposal);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/proposals/:id/vote", (req, res) => {
  try {
    const { id } = req.params;
    const { operatorDid, approve } = req.body;
    if (!operatorDid) {
      return res.status(400).json({ error: "operatorDid required" });
    }

    const row = db.prepare("SELECT * FROM proposals WHERE proposal_id = ?").get(id) as any;
    if (!row) return res.status(404).json({ error: "Proposal not found" });
    if (row.status !== "pending") return res.status(400).json({ error: "Proposal already resolved" });

    const votes = JSON.parse(row.votes) as { operator: string; approve: boolean }[];
    if (votes.some(v => v.operator === operatorDid)) {
      return res.status(409).json({ error: "Operator already voted" });
    }

    votes.push({ operator: operatorDid, approve: !!approve });

    const approveCount = votes.filter(v => v.approve).length;
    const rejectCount = votes.filter(v => !v.approve).length;
    let status = "pending";
    if (approveCount >= row.required_votes) status = "executed";
    else if (rejectCount >= row.required_votes) status = "rejected";

    db.prepare("UPDATE proposals SET votes = ?, status = ? WHERE proposal_id = ?")
      .run(JSON.stringify(votes), status, id);

    res.json({ proposalId: id, votes, status, approveCount, rejectCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/escalations", (_req, res) => {
  try {
    const rows = db.prepare("SELECT * FROM escalations WHERE status = 'pending' ORDER BY created_at DESC").all() as any[];
    res.json(rows.map(r => ({
      escalationId: r.escalation_id,
      agentDid: r.agent_did,
      requestId: r.request_id,
      amount: r.amount,
      reason: r.reason,
      status: r.status,
      createdAt: r.created_at,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message, escalations: [] });
  }
});

router.post("/escalations/:id/resolve", (req, res) => {
  try {
    const { id } = req.params;
    const { decision, reason } = req.body;
    if (!decision || !["APPROVE", "DENY"].includes(decision)) {
      return res.status(400).json({ error: "decision must be APPROVE or DENY" });
    }
    const status = decision === "APPROVE" ? "approved" : "denied";
    const result = db.prepare(
      "UPDATE escalations SET status = ?, resolved_at = ?, resolution = ?, resolved_by = ? WHERE escalation_id = ? AND status = 'pending'"
    ).run(status, Date.now(), reason || `Resolved via governance`, "operator", id);
    if (result.changes === 0) return res.status(404).json({ error: "Escalation not found or already resolved" });

    db.prepare(
      "INSERT INTO audit_log (id, timestamp, agent_did, decision, policy_clause, action, receipt_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(
      `gov-resolve-${id}`, Date.now(), "governance", `ESCALATION_${decision}`,
      `governance_resolved:${id}=${decision}`,
      JSON.stringify({ type: "governance_resolve", resource: id }),
      `gov-${id}`
    );

    res.json({ escalationId: id, status, resolved: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
