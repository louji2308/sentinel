"use client";
import { useEffect, useState } from "react";
import { Card, DecisionBadge, Table, Td } from "../../components/ui";
import { fetchAuditLog, fetchReceipt, exportAuditLog, type AuditEntry } from "../../lib/api";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verification, setVerification] = useState<any>(null);

  useEffect(() => {
    fetchAuditLog().then((log) => setEntries(log.entries || [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleVerify(receiptId: string) {
    try {
      const result = await fetchReceipt(receiptId);
      setVerification(result.verification);
    } catch {
      setVerification({ valid: false, error: "Receipt not found" });
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 pt-24 pb-10">
        <div className="animate-rise mb-1 text-sm tracking-ultra text-gold">TAMPER-EVIDENT LEDGER</div>
        <div className="animate-rise delay-1 mb-8 flex items-center justify-between">
          <h1 className="text-4xl font-light">Audit Log</h1>
          <button
            onClick={exportAuditLog}
            className="rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
          >
            Export JSON
          </button>
        </div>

        {verification && (
          <Card
            title="Receipt Verification"
            className={`animate-scale mb-6 border-l-4 ${
              verification.valid ? "border-l-permit" : "border-l-deny"
            }`}
          >
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-foreground/80">
              {JSON.stringify(verification, null, 2)}
            </pre>
            <button
              onClick={() => setVerification(null)}
              className="mt-4 rounded-full border border-white/15 px-4 py-1.5 text-xs text-muted transition hover:bg-white/5 hover:text-foreground"
            >
              Close
            </button>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center gap-3 text-muted">
            <span className="h-4 w-4 animate-spin-slow rounded-full border-2 border-gold/30 border-t-gold" />
            Loading audit trail…
          </div>
        ) : (
          <Card className="animate-fade delay-2">
            <Table head={["Time", "Agent", "Action", "Decision", "Clause", "Receipt"]}>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <Td muted>{new Date(e.timestamp).toLocaleString()}</Td>
                  <Td mono>{e.agentDid.split(":").pop()?.slice(0, 16)}…</Td>
                  <Td>{e.action.type}</Td>
                  <Td>
                    <DecisionBadge decision={e.decision} />
                  </Td>
                  <Td mono>{e.policyClause}</Td>
                  <Td>
                    <button
                      onClick={() => handleVerify(e.receiptId)}
                      className="rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-bright transition hover:bg-gold/20"
                    >
                      Verify
                    </button>
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
