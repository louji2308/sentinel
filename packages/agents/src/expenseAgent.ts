import "dotenv/config";
import { requestCompliance, logResult, registerWithOracle } from "./agentBase.js";

const EXPENSE_DID = "did:t3n:expense-agent-demo";
const TRAVEL_DID = "did:t3n:travel-agent-demo";

/**
 * Expense Agent — Receives delegated expense submissions from the Travel Agent.
 *
 * This demonstrates agent-to-agent delegation under compliance control:
 * 1. Travel Agent books a flight (already PERMIT'd)
 * 2. Travel Agent delegates expense submission to Expense Agent, which has
 *    its OWN independently-scoped credential
 * 3. Expense Agent independently requests compliance
 * 4. The audit trail contains BOTH actions with the delegation recorded in metadata
 */

async function ensureRegistered() {
  // Register expense agent with the oracle (which forwards to TEE contract)
  await registerWithOracle(EXPENSE_DID, "expense-processing");

  // Also register directly with the correct scope via the admin API
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001"}/api/admin/register-agent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentDid: EXPENSE_DID,
        credentialType: "expense-processing",
        credentialScope: ["spend:5000", "domain:expense,finance"],
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.warn(`[Expense] Registration note: ${err.slice(0, 100)}`);
  } else {
    console.log("  [Expense] Registered with scope: spend:5000, domain:expense,finance");
  }
}

const scenarios = [
  { label: "Submit expense $200 (within policy)", action: "submit_expense", resource: "ExpenseSystem", amount: 200, metadata: { domain: "expense", delegatedBy: TRAVEL_DID, parentAction: "book_flight" } },
  { label: "Submit expense $4,500 (near cap -> escalate)", action: "submit_expense", resource: "ExpenseSystem", amount: 4500, metadata: { domain: "expense", delegatedBy: TRAVEL_DID, parentAction: "book_flight" } },
  { label: "Submit expense $8,000 (over cap -> deny)", action: "submit_expense", resource: "ExternalPaymentRail", amount: 8000, metadata: { domain: "expense", delegatedBy: TRAVEL_DID } },
];

export async function runExpenseAgent() {
  console.log("\n=== Expense Agent (Delegation Demo) ===");
  console.log("  (Delegated by Travel Agent after flight booking)");
  console.log("  (Independently scoped credential - separate from Travel)");

  await ensureRegistered();

  for (const s of scenarios) {
    try {
      const result = await requestCompliance(EXPENSE_DID, s.action, s.resource, s.amount, s.metadata);
      logResult(s.label, result);

      if (result.decision === "ESCALATE" && result.escalationId) {
        console.log(`  \u26a0\ufe0f Delegated expense flagged for operator review (${result.escalationId})`);
      }
    } catch (err: any) {
      console.error(`\u274c [${s.label}] Error: ${err.message}`);
    }
  }
}
