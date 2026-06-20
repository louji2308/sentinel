import { Router } from "express";
import { db } from "../services/db";

const router = Router();

router.get("/velocity/:agentDid", (req, res) => {
  const { agentDid } = req.params;
  const rows = db.prepare(
    "SELECT bucket, SUM(amount) as total, COUNT(*) as txCount, MIN(timestamp) as windowStart, MAX(timestamp) as windowEnd FROM spend_ledger WHERE agent_did = ? AND timestamp > ? GROUP BY bucket ORDER BY bucket"
  ).all(agentDid, Date.now() - 604800_000);

  const windows = { hourly: 0, daily: 0, weekly: 0, hourly_count: 0, daily_count: 0, weekly_count: 0 };
  for (const r of rows) {
    if (r.bucket === "hourly") { windows.hourly = r.total; windows.hourly_count = r.txCount; }
    if (r.bucket === "daily")  { windows.daily = r.total; windows.daily_count = r.txCount; }
    if (r.bucket === "weekly") { windows.weekly = r.total; windows.weekly_count = r.txCount; }
  }
  const cap = db.prepare("SELECT spend_cap FROM agents WHERE did = ?").get(agentDid);
  res.json({ agentDid, windows, cap: cap?.spend_cap ?? 0, ts: Date.now() });
});

router.get("/velocity/summary", (_req, res) => {
  const rows = db.prepare("SELECT agent_did, bucket, SUM(amount) as total, COUNT(*) as txCount FROM spend_ledger WHERE timestamp > ? GROUP BY agent_did, bucket ORDER BY agent_did, bucket").all(Date.now() - 604800_000);
  const byAgent: Record<string, any> = {};
  for (const r of rows) {
    if (!byAgent[r.agent_did]) byAgent[r.agent_did] = { hourly: 0, daily: 0, weekly: 0 };
    byAgent[r.agent_did][r.bucket] = { total: r.total, txCount: r.txCount };
  }
  res.json({ agents: byAgent, ts: Date.now() });
});

export default router;
