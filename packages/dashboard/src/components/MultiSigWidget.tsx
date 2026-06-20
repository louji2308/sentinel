"use client";

import { useEffect, useState } from "react";
import { Card, Table, Td } from "./ui";
import { fetchProposals, voteProposal, createProposal, type ProposalInfo } from "../lib/api";

const OPERATOR_DID = process.env.NEXT_PUBLIC_OPERATOR_DID || "did:t3n:operator-1";

export function MultiSigWidget() {
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formAction, setFormAction] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formVotes, setFormVotes] = useState("2");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetchProposals().then(setProposals).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleVote(proposalId: string, approve: boolean) {
    setVoting(proposalId);
    try {
      await voteProposal(proposalId, OPERATOR_DID, approve);
      setProposals(prev =>
        prev.map(p =>
          p.proposalId === proposalId
            ? { ...p, votes: [...p.votes, { operator: OPERATOR_DID, approve }] }
            : p
        )
      );
    } catch {}
    setVoting(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const numVotes = parseInt(formVotes, 10);
    if (!formAction.trim() || !formTarget.trim()) {
      setFormError("Action and Target ID are required");
      return;
    }
    if (isNaN(numVotes) || numVotes < 1) {
      setFormError("Required votes must be at least 1");
      return;
    }
    try {
      const result = await createProposal(formAction.trim(), formTarget.trim(), numVotes);
      setProposals(prev => [result, ...prev]);
      setShowForm(false);
      setFormAction("");
      setFormTarget("");
      setFormVotes("2");
    } catch (err: any) {
      setFormError(err.message);
    }
  }

  if (loading) {
    return (
      <Card title="Multi-Sig Governance">
        <div className="flex items-center gap-3 text-muted text-sm">
          <span className="h-3 w-3 animate-spin-slow rounded-full border-2 border-gold/30 border-t-gold" />
          Loading proposals…
        </div>
      </Card>
    );
  }

  return (
    <Card title={`Multi-Sig Proposals (${proposals.filter(p => p.status === "pending").length} pending)`}>
      {proposals.length === 0 && !showForm ? (
        <p className="text-sm text-muted mb-4">No governance proposals yet.</p>
      ) : (
        <div className="mb-4">
          <Table head={["Action", "Target", "Votes", "Status", "Vote"]}>
            {proposals.map(p => {
              const voted = p.votes.some((v: any) => v.operator === OPERATOR_DID);
              return (
                <tr key={p.proposalId} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <Td>{p.action}</Td>
                  <Td mono>{p.targetId.split(":").pop()?.slice(0, 12)}…</Td>
                  <Td>
                    <span className="text-permit">{p.votes.filter((v: any) => v.approve).length}</span>
                    <span className="text-muted">/{p.requiredVotes}</span>
                  </Td>
                  <Td>
                    <span className={`capitalize ${p.status === "executed" ? "text-permit" : p.status === "rejected" ? "text-deny" : "text-escalate"}`}>
                      {p.status}
                    </span>
                  </Td>
                  <Td>
                    {p.status === "pending" && !voted && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleVote(p.proposalId, true)}
                          disabled={voting === p.proposalId}
                          className="rounded-full border border-permit/40 bg-permit/10 px-2 py-0.5 text-[10px] font-medium text-permit transition hover:bg-permit/20 disabled:opacity-50"
                        >
                          Yea
                        </button>
                        <button
                          onClick={() => handleVote(p.proposalId, false)}
                          disabled={voting === p.proposalId}
                          className="rounded-full border border-deny/40 bg-deny/10 px-2 py-0.5 text-[10px] font-medium text-deny transition hover:bg-deny/20 disabled:opacity-50"
                        >
                          Nay
                        </button>
                      </div>
                    )}
                    {voted && <span className="text-xs text-muted">Voted</span>}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </div>
      )}

      {showForm ? (
        <form onSubmit={handleCreate} className="border-t border-white/10 pt-4 space-y-3">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1">Action</label>
            <input
              value={formAction}
              onChange={e => setFormAction(e.target.value)}
              placeholder="e.g. revoke_agent, update_policy"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-gold/40 transition"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1">Target ID</label>
            <input
              value={formTarget}
              onChange={e => setFormTarget(e.target.value)}
              placeholder="e.g. did:t3n:agent-1, system:policy:..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground placeholder:text-muted/50 outline-none focus:border-gold/40 transition"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted mb-1">Required Votes</label>
            <input
              type="number"
              min={1}
              value={formVotes}
              onChange={e => setFormVotes(e.target.value)}
              className="w-24 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground outline-none focus:border-gold/40 transition"
            />
          </div>
          {formError && <p className="text-xs text-deny">{formError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
            >
              Create Proposal
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(""); }}
              className="rounded-full border border-white/15 px-4 py-1.5 text-xs font-medium text-muted transition hover:bg-white/5"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
        >
          + New Proposal
        </button>
      )}
    </Card>
  );
}
