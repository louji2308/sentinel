"use client";
import { useEffect, useState } from "react";
import { Card, DecisionBadge, StatusDot } from "../components/ui";
import { fetchAuditLog, fetchAgents, type AuditEntry, type AgentInfo } from "../lib/api";

export default function Dashboard() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchAuditLog(), fetchAgents()])
      .then(([e, a]) => { setEntries(e); setAgents(a); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;

  const counts = { PERMIT: 0, DENY: 0, ESCALATE: 0 };
  for (const e of entries) {
    if (e.decision in counts) counts[e.decision as keyof typeof counts]++;
  }

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Compliance Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#16a34a" }}>{counts.PERMIT}</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Permitted</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#dc2626" }}>{counts.DENY}</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Denied</div>
          </div>
        </Card>
        <Card>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#f59e0b" }}>{counts.ESCALATE}</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>Escalated</div>
          </div>
        </Card>
      </div>

      <Card title="Registered Agents">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Agent</th>
              <th style={{ padding: "8px 12px" }}>Type</th>
              <th style={{ padding: "8px 12px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.did} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 12 }}>{a.did}</td>
                <td style={{ padding: "8px 12px" }}>{a.credentialType}</td>
                <td style={{ padding: "8px 12px" }}>
                  <StatusDot status={a.credentialStatus} />
                  {a.credentialStatus}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Recent Verdicts">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Time</th>
              <th style={{ padding: "8px 12px" }}>Agent</th>
              <th style={{ padding: "8px 12px" }}>Action</th>
              <th style={{ padding: "8px 12px" }}>Decision</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
                  {new Date(e.timestamp).toLocaleTimeString()}
                </td>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>
                  {e.agentDid.split(":").pop()?.slice(0, 12)}...
                </td>
                <td style={{ padding: "8px 12px" }}>{e.action.type}</td>
                <td style={{ padding: "8px 12px" }}>
                  <DecisionBadge decision={e.decision} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}