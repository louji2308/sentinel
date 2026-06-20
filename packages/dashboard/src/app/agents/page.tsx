"use client";
import { useEffect, useState } from "react";
import { Card, StatusDot, Table, Td } from "../../components/ui";
import { fetchAgents, revokeAgent, registerAgent, type AgentInfo } from "../../lib/api";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [fDid, setFDid] = useState("");
  const [fType, setFType] = useState("");
  const [fScope, setFScope] = useState("");
  const [fError, setFError] = useState("");

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

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setFError("");
    if (!fDid.trim() || !fType.trim()) {
      setFError("Agent DID and Credential Type are required");
      return;
    }
    const scope = fScope.trim()
      ? fScope.split(",").map(s => s.trim()).filter(Boolean)
      : undefined;
    try {
      const result = await registerAgent(fDid.trim(), fType.trim(), scope);
      setMessage(`Agent ${result.agentDid} registered (${result.storage})`);
      setAgents(await fetchAgents());
      setShowForm(false);
      setFDid("");
      setFType("");
      setFScope("");
    } catch (err: any) {
      setFError(err.message);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-10">
        <div className="animate-rise mb-1 text-sm tracking-ultra text-gold">IDENTITY CONTROL</div>
        <h1 className="animate-rise delay-1 mb-8 text-4xl font-light">Agent Management</h1>

        {message && (
          <div className="glass-gold animate-scale mb-6 rounded-2xl px-5 py-3 text-sm text-gold-bright">
            {message}
          </div>
        )}

        <div className="animate-fade delay-2 space-y-6">
          <Card title="Registered Agents">
            {loading ? (
              <div className="flex items-center gap-3 text-muted">
                <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-gold/30 border-t-gold" />
                Loading agents…
              </div>
            ) : agents.length === 0 ? (
              <p className="text-sm text-muted">No agents registered yet.</p>
            ) : (
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
            )}
          </Card>

          {showForm ? (
            <Card title="Register New Agent">
              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted mb-1">Agent DID</label>
                  <input
                    value={fDid}
                    onChange={e => setFDid(e.target.value)}
                    placeholder="did:t3n:my-agent"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-gold/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted mb-1">Credential Type</label>
                  <input
                    value={fType}
                    onChange={e => setFType(e.target.value)}
                    placeholder="e.g. travel-booking, hr-payroll"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-gold/40 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-muted mb-1">Scope (comma-separated, optional)</label>
                  <input
                    value={fScope}
                    onChange={e => setFScope(e.target.value)}
                    placeholder='spend:5000, domain:flights,hotels'
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-gold/40 transition"
                  />
                </div>
                {fError && <p className="text-xs text-deny">{fError}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setFError(""); }}
                    className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-muted transition hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Card>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={() => setShowForm(true)}
                className="rounded-full border border-gold/30 bg-gold/10 px-5 py-2 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
              >
                + Register Agent
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
