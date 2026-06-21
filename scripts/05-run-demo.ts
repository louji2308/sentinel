import "dotenv/config";
import { runTravelAgent } from "../packages/agents/src/travelAgent.js";
import { runHrPayrollAgent } from "../packages/agents/src/hrPayrollAgent.js";
import { runRogueAgent } from "../packages/agents/src/rogueAgent.js";
import { runExpenseAgent } from "../packages/agents/src/expenseAgent.js";

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     SENTINEL COMPLIANCE ORACLE DEMO      ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`Oracle: ${process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001"}`);
  console.log("");

  // Act 1 — Travel Agent (within policy, near cap, over cap with retry)
  await runTravelAgent();
  console.log("");

  // Act 2 — HR/Payroll Agent (payroll, HR records, external domain, near-cap escalate -> resolve)
  await runHrPayrollAgent();
  console.log("");

  // Act 3 — Rogue Agent (all denied, retry exhausted)
  await runRogueAgent();
  console.log("");

  // Act 4 — Expense Agent (delegated by Travel Agent, demonstrates agent-to-agent)
  await runExpenseAgent();

  console.log("\n=== Demo Complete ===");
  console.log("All compliance decisions recorded in TEE contract.");
  const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000";
  console.log(`View dashboard at ${dashboardUrl}/dashboard`);
}

main().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});