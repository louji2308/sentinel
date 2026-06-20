import { Router } from "express";
import { callContract } from "../services/sentinelContract.js";

const router = Router();

router.get("/stream", async (req, res) => {
  try {
    const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    const result = await callContract("query-audit-log", {
      startTs: since,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
    });
    res.json({
      entries: result,
      cursor: Date.now().toString(),
    });
  } catch (err: any) {
    console.error("[Audit] Stream error:", err);
    res.status(500).json({ error: err.message, entries: [] });
  }
});

router.get("/agents", async (_req, res) => {
  try {
    const result = await callContract("query-audit-log", {
      limit: 200,
    });
    const entries: any[] = Array.isArray(result) ? result : [];
    const agentDids = new Set(entries.map((e: any) => e.agentDid));
    const agents = Array.from(agentDids).map((did) => ({
      did,
      credentialType: "unknown",
      credentialStatus: "active",
    }));
    res.json({ agents });
  } catch (err: any) {
    console.error("[Audit] Agents error:", err);
    res.status(500).json({ error: err.message, agents: [] });
  }
});

router.get("/receipt/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Valid receipt ID is required" });
    }

    const verification = await callContract("verify-receipt", {
      receiptId: id.startsWith("RCP-") || id.startsWith("DENIED-") ? id : `RCP-${id}`,
      agentDid: req.query.agentDid || "",
    });

    res.json({ receiptId: id, verification });
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      return res.status(404).json({ error: "Receipt not found" });
    }
    console.error("[Audit] Receipt verification error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/export", async (req, res) => {
  try {
    const result = await callContract("query-audit-log", {
      limit: 10000,
    });
    const entries: any[] = Array.isArray(result) ? result : [];
    const exportData = {
      exportedAt: Date.now(),
      totalEntries: entries.length,
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
