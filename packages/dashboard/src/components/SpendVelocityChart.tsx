"use client";

import { useEffect, useState } from "react";
import { Card } from "./ui";
import { fetchVelocity } from "../lib/api";

interface VelocityData {
  agentDid: string;
  windows: {
    hourly: number;
    daily: number;
    weekly: number;
    hourly_count: number;
    daily_count: number;
    weekly_count: number;
  };
  cap: number;
}

export function SpendVelocityChart({ agentDid }: { agentDid: string }) {
  const [data, setData] = useState<VelocityData | null>(null);

  useEffect(() => {
    fetchVelocity(agentDid).then(setData);
  }, [agentDid]);

  if (!data) return null;

  const bars = [
    { label: "1h", value: data.windows.hourly, max: data.cap / 10, color: "bg-permit" },
    { label: "24h", value: data.windows.daily, max: data.cap, color: "bg-escalate" },
    { label: "7d", value: data.windows.weekly, max: data.cap * 3, color: "bg-gold" },
  ];

  return (
    <Card title={`Spend Velocity — ${agentDid.split(":").pop()}`} className="min-w-[280px]">
      <div className="space-y-3">
        {bars.map(b => {
          const pct = b.max > 0 ? Math.min((b.value / b.max) * 100, 100) : 0;
          return (
            <div key={b.label}>
              <div className="flex justify-between text-xs text-muted mb-1">
                <span>{b.label}</span>
                <span>${b.value.toLocaleString()} / ${b.max.toLocaleString()}</span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${b.color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
