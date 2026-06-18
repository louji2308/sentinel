"use client";
import { useEffect, useState } from "react";
import { Card, StatusDot } from "../../components/ui";
import { fetchAgents, revokeAgent, type AgentInfo } from "../../lib/api";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchAgents().then(setAgents).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleRevoke(did: string) {
    if (!confirm(`Revoke agent ${did}?`)) return;
    try {
      const result = await revokeAgent(did, "Revoked from dashboard");
      setMessage(`✅ ${result.agentDid} revoked`);
      setAgents(agents.map((a) => (a.did === did ? { ...a, credentialStatus: "revoked" } : a)));
    } catch (err: any) {
      setMessage(`❌ ${err.message}`);
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Agent Management</h1>

      {message && (
        <div style={{ padding: "8px 16px", background: "#f3f4f6", borderRadius: 6, marginBottom: 16, fontSize: 14 }}>
          {message}
        </div>
      )}

      <Card>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>DID</th>
              <th style={{ padding: "8px 12px" }}>Type</th>
              <th style={{ padding: "8px 12px" }}>Status</th>
              <th style={{ padding: "8px 12px" }}>Actions</th>
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
                <td style={{ padding: "8px 12px" }}>
                  {a.credentialStatus === "active" && (
                    <button
                      onClick={() => handleRevoke(a.did)}
                      style={{
                        padding: "4px 12px",
                        fontSize: 12,
                        background: "#dc2626",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}