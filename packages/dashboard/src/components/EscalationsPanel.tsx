"use client";

import { useEffect, useState } from "react";
import { Card, DecisionBadge, Table, Td } from "./ui";
import { fetchEscalations, resolveEscalation, type EscalationInfo } from "../lib/api";

export function EscalationsPanel() {
  const [escalations, setEscalations] = useState<EscalationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchEscalations().then(setEscalations).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleResolve(escalationId: string, decision: "APPROVE" | "DENY") {
    setResolving(escalationId);
    try {
      await resolveEscalation(escalationId, decision);
      setEscalations(prev => prev.filter(e => e.escalationId !== escalationId));
    } catch {}
    setResolving(null);
  }

  if (loading) {
    return (
      <Card title="Pending Escalations">
        <div className="flex items-center gap-3 text-muted text-sm">
          <span className="h-3 w-3 animate-spin-slow rounded-full border-2 border-gold/30 border-t-gold" />
          Loading escalations…
        </div>
      </Card>
    );
  }

  if (escalations.length === 0) {
    return (
      <Card title="Escalations">
        <p className="text-sm text-muted">No pending escalations.</p>
      </Card>
    );
  }

  return (
    <Card title={`Pending Escalations (${escalations.length})`}>
      <Table head={["Agent", "Amount", "Reason", "Time", "Actions"]}>
        {escalations.map(e => (
          <tr key={e.escalationId} className="border-t border-white/5 transition hover:bg-white/[0.03]">
            <Td mono>{e.agentDid.split(":").pop()?.slice(0, 12)}…</Td>
            <Td>${e.amount.toLocaleString()}</Td>
            <Td className="max-w-[200px] truncate text-muted">{e.reason}</Td>
            <Td muted>{new Date(e.createdAt).toLocaleString()}</Td>
            <Td>
              <div className="flex gap-2">
                <button
                  onClick={() => handleResolve(e.escalationId, "APPROVE")}
                  disabled={resolving === e.escalationId}
                  className="rounded-full border border-permit/40 bg-permit/10 px-3 py-1 text-xs font-medium text-permit transition hover:bg-permit/20 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleResolve(e.escalationId, "DENY")}
                  disabled={resolving === e.escalationId}
                  className="rounded-full border border-deny/40 bg-deny/10 px-3 py-1 text-xs font-medium text-deny transition hover:bg-deny/20 disabled:opacity-50"
                >
                  Deny
                </button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
