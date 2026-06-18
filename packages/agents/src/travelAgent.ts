import "dotenv/config";
import { requestCompliance, logResult } from "./agentBase.js";

const AGENT_DID = "did:t3n:travel-agent-demo";

const scenarios = [
  { label: "Book flight $500 (work hours)", action: "book_flight", resource: "TravelSystem", amount: 500, metadata: { domain: "travel" } },
  { label: "Search flights (work hours)", action: "search_flights", resource: "TravelSystem", amount: 0, metadata: { domain: "travel" } },
  { label: "Book flight $9,000 (near cap → escalate)", action: "book_flight", resource: "TravelSystem", amount: 9000, metadata: { domain: "travel" } },
  { label: "Execute payment $15,000 (over cap → deny)", action: "execute_payment", resource: "PaymentRail", amount: 15000, metadata: { domain: "travel" } },
];

export async function runTravelAgent() {
  console.log("\n=== Travel Agent Demo ===");
  for (const s of scenarios) {
    try {
      const result = await requestCompliance(AGENT_DID, s.action, s.resource, s.amount, s.metadata);
      logResult(s.label, result);
    } catch (err: any) {
      console.error(`❌ [${s.label}] Error: ${err.message}`);
    }
  }
}