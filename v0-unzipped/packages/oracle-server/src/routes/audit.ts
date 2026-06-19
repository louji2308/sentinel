import { Router } from "express";
import { getLog, findEntry, getLogSince } from "../services/auditLog.js";
import { getAllAgents } from "../services/agentRegistry.js";
import crypto from "crypto";

const router = Router();

router.get("/stream", (req, res) => {
  const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
  const entries = getLogSince(since);

  res.json({
    entries,
    cursor: Date.now().toString(),
  });
});

router.get("/agents", (_req, res) => {
  const agents = getAllAgents().map((a) => ({
    did: a.did,
    credentialType: a.credentialType,
    credentialStatus: a.credentialStatus,
    issuedAt: a.issuedAt,
    expiresAt: a.expiresAt,
  }));
  res.json({ agents });
});

router.get("/receipt/:id", (req, res) => {
  const entry = findEntry(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: "Receipt not found" });
  }

  const verification = {
    valid: entry.decision !== "DENY",
    receiptId: entry.receiptId,
    agentDid: entry.agentDid,
    decision: entry.decision,
    policyClause: entry.policyClause,
    verifiedAt: Date.now(),
    signature: `sig-${crypto.createHash("sha256").update(entry.receiptId + entry.policyClause).digest("hex")}`,
  };

  res.json({ entry, verification });
});

export default router;