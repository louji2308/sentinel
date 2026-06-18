"use client";
import { useEffect, useState } from "react";
import { Card, DecisionBadge } from "../../components/ui";
import { fetchAuditLog, fetchReceipt, type AuditEntry } from "../../lib/api";

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verification, setVerification] = useState<any>(null);

  useEffect(() => {
    fetchAuditLog().then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleVerify(receiptId: string) {
    setVerifying(receiptId);
    try {
      const result = await fetchReceipt(receiptId);
      setVerification(result.verification);
    } catch {
      setVerification({ valid: false, error: "Receipt not found" });
    }
  }

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>Audit Log</h1>

      {verification && (
        <Card title="Receipt Verification" style={{ borderLeft: `4px solid ${verification.valid ? "#16a34a" : "#dc2626"}` }}>
          <pre style={{ fontSize: 12, fontFamily: "monospace", whiteSpace: "pre-wrap", margin: 0 }}>
            {JSON.stringify(verification, null, 2)}
          </pre>
          <button
            onClick={() => setVerification(null)}
            style={{ marginTop: 8, padding: "4px 12px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "#fff", cursor: "pointer" }}
          >
            Close
          </button>
        </Card>
      )}

      <Card>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#6b7280", textAlign: "left" }}>
              <th style={{ padding: "8px 12px" }}>Time</th>
              <th style={{ padding: "8px 12px" }}>Agent</th>
              <th style={{ padding: "8px 12px" }}>Action</th>
              <th style={{ padding: "8px 12px" }}>Decision</th>
              <th style={{ padding: "8px 12px" }}>Clause</th>
              <th style={{ padding: "8px 12px" }}>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "8px 12px", fontSize: 12, color: "#6b7280" }}>
                  {new Date(e.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>
                  {e.agentDid.split(":").pop()?.slice(0, 16)}...
                </td>
                <td style={{ padding: "8px 12px" }}>{e.action.type}</td>
                <td style={{ padding: "8px 12px" }}>
                  <DecisionBadge decision={e.decision} />
                </td>
                <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{e.policyClause}</td>
                <td style={{ padding: "8px 12px" }}>
                  <button
                    onClick={() => handleVerify(e.receiptId)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 11,
                      border: "1px solid #d1d5db",
                      borderRadius: 4,
                      background: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    Verify
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}