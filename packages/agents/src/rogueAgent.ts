import "dotenv/config";
import { requestCompliance, logResult, retryWithReducedScope } from "./agentBase.js";

const AGENT_DID = "did:t3n:rogue-agent-demo";

const scenarios = [
  { label: "Rogue tries to book flight (denied - wrong type)", action: "book_flight", resource: "TravelSystem", amount: 5000, metadata: { domain: "travel" } },
  { label: "Rogue tries to execute payment $100,000 (denied - over cap)", action: "execute_payment", resource: "PaymentRail", amount: 100000, metadata: { domain: "finance" } },
];

export async function runRogueAgent() {
  console.log("\n=== Rogue Agent Demo ===");
  for (const s of scenarios) {
    try {
      const result = await requestCompliance(AGENT_DID, s.action, s.resource, s.amount, s.metadata);
      logResult(s.label, result);

      if (result.decision === "DENY" && s.amount && s.amount > 0) {
        console.log(`  \u21bb Rogue agent attempting retry with reduced scope...`);
        const retryResult = await retryWithReducedScope(AGENT_DID, s.action, s.resource, s.amount, s.metadata);
        if (retryResult) {
          logResult(`${s.label} (retry)`, retryResult);
        } else {
          console.log(`  \u274c Rogue agent exhausted retry options. All attempts denied.`);
        }
      }
    } catch (err: any) {
      console.error(`\u274c [${s.label}] Error: ${err.message}`);
    }
  }
}
