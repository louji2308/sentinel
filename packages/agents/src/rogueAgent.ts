import "dotenv/config";
import { requestCompliance, logResult } from "./agentBase.js";

const AGENT_DID = "did:t3n:rogue-agent-demo";

const scenarios = [
  { label: "Rogue tries to book flight", action: "book_flight", resource: "TravelSystem", amount: 5000, metadata: { domain: "travel" } },
  { label: "Rogue tries to execute payment", action: "execute_payment", resource: "PaymentRail", amount: 100000, metadata: { domain: "finance" } },
];

export async function runRogueAgent() {
  console.log("\n=== Rogue Agent Demo ===");
  for (const s of scenarios) {
    try {
      const result = await requestCompliance(AGENT_DID, s.action, s.resource, s.amount, s.metadata);
      logResult(s.label, result);
    } catch (err: any) {
      console.error(`❌ [${s.label}] Error: ${err.message}`);
    }
  }
}