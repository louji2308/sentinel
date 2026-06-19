import "dotenv/config";
import { runTravelAgent } from "../packages/agents/src/travelAgent.js";
import { runHrPayrollAgent } from "../packages/agents/src/hrPayrollAgent.js";
import { runRogueAgent } from "../packages/agents/src/rogueAgent.js";

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     SENTINEL COMPLIANCE ORACLE DEMO      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Oracle: ${process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001"}`);

  await runTravelAgent();
  await runHrPayrollAgent();
  await runRogueAgent();

  console.log("\n=== Demo Complete ===");
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});