"use client";
import { useEffect, useState } from "react";
import { Card, StatusDot, Table, Td } from "../../components/ui";
import { AppHeader } from "../../components/app-header";
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
      setMessage(`${result.agentDid} revoked`);
      setAgents(agents.map((a) => (a.did === did ? { ...a, credentialStatus: "revoked" } : a)));
    } catch (err: any) {
      setMessage(err.message);
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-rise mb-1 text-sm tracking-ultra text-gold">IDENTITY CONTROL</div>
        <h1 className="animate-rise delay-1 mb-8 text-4xl font-light">Agent Management</h1>

        {message && (
          <div className="glass-gold animate-scale mb-6 rounded-2xl px-5 py-3 text-sm text-gold-bright">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-muted">
            <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-gold/30 border-t-gold" />
            Loading agents…
          </div>
        ) : (
          <Card className="animate-fade delay-2">
            <Table head={["DID", "Type", "Status", "Actions"]}>
              {agents.map((a) => (
                <tr key={a.did} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <Td mono>{a.did}</Td>
                  <Td>{a.credentialType}</Td>
                  <Td>
                    <StatusDot status={a.credentialStatus} />
                    <span className="capitalize">{a.credentialStatus}</span>
                  </Td>
                  <Td>
                    {a.credentialStatus === "active" && (
                      <button
                        onClick={() => handleRevoke(a.did)}
                        className="rounded-full border border-deny/40 bg-deny/10 px-4 py-1.5 text-xs font-medium text-deny transition hover:bg-deny/20"
                      >
                        Revoke
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          </Card>
        )}
      </main>
    </div>
  );
}
