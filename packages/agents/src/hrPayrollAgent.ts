import "dotenv/config";
import { requestCompliance, logResult, resolveEscalation } from "./agentBase.js";

const AGENT_DID = "did:t3n:hr-payroll-demo";

const scenarios = [
  { label: "Process payroll $50,000 (valid domain)", action: "execute_payment", resource: "FinanceSystem", amount: 50000, metadata: { domain: "finance" } },
  { label: "Access HR records", action: "read_records", resource: "HRDatabase", amount: 0, metadata: { domain: "hr" } },
  { label: "External payment $10,000 (prohibited domain)", action: "execute_payment", resource: "ExternalPaymentRail", amount: 10000, metadata: { domain: "external" } },
  { label: "Near-cap payment $95,000 (escalate)", action: "execute_payment", resource: "FinanceSystem", amount: 95000, metadata: { domain: "finance" } },
];

export async function runHrPayrollAgent() {
  console.log("\n=== HR/Payroll Agent Demo ===");
  for (const s of scenarios) {
    try {
      const result = await requestCompliance(AGENT_DID, s.action, s.resource, s.amount, s.metadata);
      logResult(s.label, result);

      if (result.decision === "ESCALATE" && result.escalationId) {
        console.log(`  \u26a0\ufe0f Escalation ${result.escalationId} requires human operator review.`);
        console.log(`  \u231b Simulating operator approval via admin API...`);
        const resolution = await resolveEscalation(result.escalationId, "APPROVE", "Operator approved after review");
        console.log(`  \u2705 Escalation resolved: ${resolution.contractResult?.status || "approved"}`);
      }
    } catch (err: any) {
      console.error(`\u274c [${s.label}] Error: ${err.message}`);
    }
  }
}
