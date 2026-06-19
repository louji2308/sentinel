"use client";
import { useEffect, useState } from "react";
import { Card, DecisionBadge, StatusDot, Table, Td } from "../../components/ui";
import { fetchAuditLog, fetchAgents, type AuditEntry, type AgentInfo } from "../../lib/api";

const stats = [
  { key: "PERMIT", label: "Permitted", className: "text-permit" },
  { key: "DENY", label: "Denied", className: "text-deny" },
  { key: "ESCALATE", label: "Escalated", className: "text-escalate" },
] as const;

export default function Dashboard() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAuditLog(), fetchAgents()])
      .then(([e, a]) => {
        setEntries(e);
        setAgents(a);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const counts: Record<string, number> = { PERMIT: 0, DENY: 0, ESCALATE: 0 };
  for (const e of entries) if (e.decision in counts) counts[e.decision]++;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-10">
        <div className="animate-rise mb-1 text-sm tracking-ultra text-gold">COMPLIANCE ORACLE</div>
        <h1 className="animate-rise delay-1 mb-8 text-4xl font-light">Live Dashboard</h1>

        {loading ? (
          <LoadingState />
        ) : (
          <div className="animate-fade delay-2 space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {stats.map((s) => (
                <Card key={s.key}>
                  <div className="text-center">
                    <div className={`font-mono text-5xl font-semibold ${s.className}`}>
                      {counts[s.key]}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-widest text-muted">{s.label}</div>
                  </div>
                </Card>
              ))}
            </div>

            <Card title="Registered Agents">
              <Table head={["Agent", "Type", "Status"]}>
                {agents.map((a) => (
                  <tr key={a.did} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                    <Td mono>{a.did}</Td>
                    <Td>{a.credentialType}</Td>
                    <Td>
                      <StatusDot status={a.credentialStatus} />
                      <span className="capitalize">{a.credentialStatus}</span>
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>

            <Card title="Recent Verdicts">
              <Table head={["Time", "Agent", "Action", "Decision"]}>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                    <Td muted>{new Date(e.timestamp).toLocaleTimeString()}</Td>
                    <Td mono>{e.agentDid.split(":").pop()?.slice(0, 12)}…</Td>
                    <Td>{e.action.type}</Td>
                    <Td>
                      <DecisionBadge decision={e.decision} />
                    </Td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3 text-muted">
      <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-gold/30 border-t-gold" />
      Loading live verdicts…
    </div>
  );
}
