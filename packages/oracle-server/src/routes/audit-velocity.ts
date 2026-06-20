import { Router } from "express";
import db from "../services/db.js";

const router = Router();

router.get("/velocity/:agentDid", (req, res) => {
  const { agentDid } = req.params;
  const rows = db.prepare(
    "SELECT window_type, SUM(amount) as total, COUNT(*) as txCount, MIN(timestamp) as windowStart, MAX(timestamp) as windowEnd FROM spend_ledger WHERE did = ? AND timestamp > ? GROUP BY window_type ORDER BY window_type"
  ).all(agentDid, Date.now() - 604800_000);

  const windows = { hourly: 0, daily: 0, weekly: 0, hourly_count: 0, daily_count: 0, weekly_count: 0 };
  for (const r of rows as any[]) {
    if (r.window_type === "hourly") { windows.hourly = r.total; windows.hourly_count = r.txCount; }
    if (r.window_type === "daily")  { windows.daily = r.total; windows.daily_count = r.txCount; }
    if (r.window_type === "weekly") { windows.weekly = r.total; windows.weekly_count = r.txCount; }
  }
  const cap = db.prepare("SELECT spend_cap FROM agents WHERE did = ?").get(agentDid);
  res.json({ agentDid, windows, cap: (cap as any)?.spend_cap ?? 0, ts: Date.now() });
});

router.get("/velocity/summary", (_req, res) => {
  const rows = db.prepare("SELECT did, window_type, SUM(amount) as total, COUNT(*) as txCount FROM spend_ledger WHERE timestamp > ? GROUP BY did, window_type ORDER BY did, window_type").all(Date.now() - 604800_000);
  const byAgent: Record<string, any> = {};
  for (const r of rows as any[]) {
    if (!byAgent[r.did]) byAgent[r.did] = { hourly: 0, daily: 0, weekly: 0 };
    byAgent[r.did][r.window_type] = { total: r.total, txCount: r.txCount };
  }
  res.json({ agents: byAgent, ts: Date.now() });
});

export default router;
