import { Router } from "express";
import crypto from "crypto";
import { callContract } from "../services/sentinelContract.js";
import { getLog, getLogSince, findEntry } from "../services/auditLog.js";
import { getAllAgents } from "../services/agentRegistry.js";

const router = Router();

router.get("/stream", async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;

    // Try contract first
    const contractResult = await callContract("query-audit-log", {
      startTs: since,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });

    if (contractResult.ok) {
      const entries = Array.isArray(contractResult.data) ? contractResult.data : [];
      return res.json({ entries, cursor: Date.now().toString() });
    }

    // Fallback: local audit log
    const logLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 2000;
    const localEntries = getLogSince(since, logLimit);
    res.json({
      entries: localEntries.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        agentDid: e.agentDid,
        decision: e.decision,
        policyClause: e.policyClause,
        action: e.action,
        receiptId: e.receiptId,
      })),
      cursor: Date.now().toString(),
    });
  } catch (err: any) {
    console.error("[Audit] Stream error:", err);
    // Last resort: return whatever we have locally
    try {
      const entries = getLogSince(0);
      res.json({ entries, cursor: Date.now().toString() });
    } catch {
      res.status(500).json({ error: err.message, entries: [] });
    }
  }
});

router.get("/agents", async (_req, res) => {
  try {
    const contractResult = await callContract("query-audit-log", { limit: 200 });

    if (contractResult.ok) {
      const entries: any[] = Array.isArray(contractResult.data) ? contractResult.data : [];
      const agentDids = new Set(entries.map((e: any) => e.agentDid));
      const agents = Array.from(agentDids).map((did) => ({
        did,
        credentialType: "unknown",
        credentialStatus: "active",
      }));
      return res.json({ agents });
    }

    // Fallback: local agent registry
    const localAgents = getAllAgents().map((a) => ({
      did: a.did,
      credentialType: a.credentialType,
      credentialStatus: a.credentialStatus,
      issuedAt: a.issuedAt,
      expiresAt: a.expiresAt,
    }));
    res.json({ agents: localAgents });
  } catch (err: any) {
    console.error("[Audit] Agents error:", err);
    try {
      const localAgents = getAllAgents().map((a) => ({
        did: a.did,
        credentialType: a.credentialType,
        credentialStatus: a.credentialStatus,
      }));
      res.json({ agents: localAgents });
    } catch {
      res.status(500).json({ error: err.message, agents: [] });
    }
  }
});

router.get("/receipt/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Valid receipt ID is required" });
    }

    // Try contract first
    const contractResult = await callContract("verify-receipt", {
      receiptId: id.startsWith("RCP-") || id.startsWith("DENIED-") ? id : `RCP-${id}`,
      agentDid: req.query.agentDid || "",
    });

    if (contractResult.ok) {
      return res.json({ receiptId: id, verification: contractResult.data });
    }

    // Fallback: local lookup
    const entry = findEntry(id);
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
      note: "Local verification only — not cryptographically sealed (contract unavailable)",
    };

    res.json({ entry, verification });
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    console.error("[Audit] Receipt error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/export", async (req, res) => {
  try {
    const contractResult = await callContract("query-audit-log", { limit: 10000 });

    let entries: any[];
    if (contractResult.ok) {
      entries = Array.isArray(contractResult.data) ? contractResult.data : [];
    } else {
      entries = getLog().map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        agentDid: e.agentDid,
        decision: e.decision,
        policyClause: e.policyClause,
        action: e.action,
        receiptId: e.receiptId,
      }));
    }

    const exportData = {
      exportedAt: Date.now(),
      totalEntries: entries.length,
      storage: contractResult.ok ? "contract" : "local",
      entries: entries.map((e: any) => ({
        id: e.id || e.receiptId,
        timestamp: e.timestamp,
        agentDid: e.agentDid,
        decision: e.decision,
        action: e.action,
        policyClause: e.policyClause,
        receiptId: e.receiptId,
      })),
    };
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="sentinel-audit-${Date.now()}.json"`);
    res.json(exportData);
  } catch (err: any) {
    console.error("[Audit] Export error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
