import { runDryRun } from "./simulator.js";

const testCases = [
  { agentType: "travel-booking", credentialStatus: "active", action: "book_flight", resourceType: "TravelSystem", resourceDomain: "travel", amount: 500, expect: "PERMIT" },
  { agentType: "travel-booking", credentialStatus: "active", action: "book_flight", resourceType: "TravelSystem", resourceDomain: "travel", amount: 9000, expect: "ESCALATE" },
  { agentType: "financial-trading", credentialStatus: "active", action: "book_flight", resourceType: "TravelSystem", resourceDomain: "travel", amount: 100, expect: "DENY" },
];

async function main() {
  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const result = await runDryRun(tc);
    const decision = result.decision || "UNKNOWN";
    if (decision === tc.expect) {
      passed++;
      console.log(`  ✅ ${tc.action} $${tc.amount} (${tc.agentType}) → ${decision}`);
    } else {
      failed++;
      console.log(`  ❌ ${tc.action} $${tc.amount} (${tc.agentType}) → ${decision} (expected ${tc.expect})`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
