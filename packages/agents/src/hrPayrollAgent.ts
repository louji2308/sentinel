import "dotenv/config";
import { requestCompliance, logResult } from "./agentBase.js";

const AGENT_DID = "did:t3n:hr-payroll-demo";

const scenarios = [
  { label: "Process payroll (valid domain)", action: "execute_payment", resource: "FinanceSystem", amount: 50000, metadata: { domain: "finance" } },
  { label: "Access HR records", action: "read_records", resource: "HRDatabase", amount: 0, metadata: { domain: "hr" } },
  { label: "External payment (prohibited domain)", action: "execute_payment", resource: "ExternalPaymentRail", amount: 10000, metadata: { domain: "external" } },
];

export async function runHrPayrollAgent() {
  console.log("\n=== HR/Payroll Agent Demo ===");
  for (const s of scenarios) {
    try {
      const result = await requestCompliance(AGENT_DID, s.action, s.resource, s.amount, s.metadata);
      logResult(s.label, result);
    } catch (err: any) {
      console.error(`❌ [${s.label}] Error: ${err.message}`);
    }
  }
}