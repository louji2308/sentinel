"use client";

import { useEffect, useState } from "react";
import { Card, Table, Td } from "./ui";
import { fetchProposals, voteProposal, type ProposalInfo } from "../lib/api";

const OPERATOR_DID = process.env.NEXT_PUBLIC_OPERATOR_DID || "did:t3n:operator-1";

export function MultiSigWidget() {
  const [proposals, setProposals] = useState<ProposalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

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
      {proposals.length === 0 ? (
        <p className="text-sm text-muted">No governance proposals yet.</p>
      ) : (
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
      )}
    </Card>
  );
}
