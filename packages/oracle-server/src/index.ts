import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import complianceRouter from "./routes/compliance.js";
import auditRouter from "./routes/audit.js";
import adminRouter from "./routes/admin.js";
import { registerAgent, clearCache } from "./services/agentRegistry.js";
import { clearCache as clearAuditCache, appendEntry } from "./services/auditLog.js";
import { callContractWithAdmin, isContractAvailable } from "./services/sentinelContract.js";

const app = express();
const PORT = parseInt(process.env.ORACLE_PORT || "3001", 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/compliance", complianceRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admin", adminRouter);
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    mode: isContractAvailable() ? "contract" : "local",
    storage: isContractAvailable()
      ? "TEE contract (persistent)"
      : "Local in-memory (volatile — deploy contract for persistence)",
  });
});

function seedLocalStores() {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  const agents = [
    {
      did: "did:t3n:travel-agent-demo",
      credentialScope: ["spend:5000", "domain:flights,hotels,trains"],
      credentialStatus: "active" as const,
      credentialType: "travel-booking",
      issuedAt: now - 7 * day,
      expiresAt: now + 30 * day,
    },
    {
      did: "did:t3n:hr-payroll-demo",
      credentialScope: ["spend:100000", "domain:payroll,benefits,hr,finance"],
      credentialStatus: "active" as const,
      credentialType: "hr-payroll",
      issuedAt: now - 7 * day,
      expiresAt: now + 30 * day,
    },
    {
      did: "did:t3n:rogue-agent-demo",
      credentialScope: ["spend:100", "domain:trading,crypto"],
      credentialStatus: "active" as const,
      credentialType: "financial-trading",
      issuedAt: now - 1 * day,
      expiresAt: now + 1 * day,
    },
  ];

  // Always seed local stores — this is the fallback that guarantees the dashboard works
  for (const agent of agents) {
    registerAgent(agent.did, agent);
    console.log(`[Seed] Local agent: ${agent.did}`);
  }

  // Seed demo audit entries so the dashboard isn't blank on first load
  const baseTs = (now - 120) * 1000;
  appendEntry({
    id: "log-demo-1", timestamp: baseTs, agentDid: "did:t3n:travel-agent-demo",
    decision: "PERMIT", policyClause: "permit(principal=travel-booking, action=book_flight)",
    action: { type: "book_flight", resource: "TravelSystem", amount: 500 },
    receiptId: "RCP-demo-permit-1",
  });
  appendEntry({
    id: "log-demo-2", timestamp: baseTs + 30000, agentDid: "did:t3n:travel-agent-demo",
    decision: "ESCALATE", policyClause: "escalate(principal=travel-booking, action=book_flight)",
    action: { type: "book_flight", resource: "TravelSystem", amount: 9000 },
    receiptId: "RCP-demo-escalate-1",
  });
  appendEntry({
    id: "log-demo-3", timestamp: baseTs + 60000, agentDid: "did:t3n:hr-payroll-demo",
    decision: "PERMIT", policyClause: "permit(principal=hr-payroll, action=execute_payment)",
    action: { type: "execute_payment", resource: "FinanceSystem", amount: 50000 },
    receiptId: "RCP-demo-permit-2",
  });
  appendEntry({
    id: "log-demo-4", timestamp: baseTs + 90000, agentDid: "did:t3n:rogue-agent-demo",
    decision: "DENY", policyClause: "forbid(principal=financial-trading, action=book_flight)",
    action: { type: "book_flight", resource: "TravelSystem", amount: 5000 },
    receiptId: "RCP-demo-deny-1",
  });

  console.log(`[Seed] Local audit entries seeded: 4 demo verdicts.`);
  console.log("[Seed] Dashboard will use local storage if TEE contract is unreachable.");
}

async function trySeedContract() {
  console.log("[Seed] Attempting to seed TEE contract...");

  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  const agents = [
    {
      agentDid: "did:t3n:travel-agent-demo",
      agentType: "travel-booking",
      scope: ["spend:5000", "domain:flights,hotels,trains"],
      issuedAt: now - 7 * day,
      expiresAt: now + 30 * day,
    },
    {
      agentDid: "did:t3n:hr-payroll-demo",
      agentType: "hr-payroll",
      scope: ["spend:100000", "domain:payroll,benefits,hr,finance"],
      issuedAt: now - 7 * day,
      expiresAt: now + 30 * day,
    },
    {
      agentDid: "did:t3n:rogue-agent-demo",
      agentType: "financial-trading",
      scope: ["spend:100", "domain:trading,crypto"],
      issuedAt: now - 1 * day,
      expiresAt: now + 1 * day,
    },
  ];

  const policies = [
    {
      agentType: "travel-booking",
      policyText: `permit(
  principal is SentinelAgent,
  action in [SentinelAction::"book_flight", SentinelAction::"search_flights", SentinelAction::"book_hotel"],
  resource is SentinelResource
) when {
  principal.agentType == "travel-booking" &&
  principal.credentialStatus == "active" &&
  resource.type in ["TravelSystem", "BookingSystem"]
};

forbid(
  principal is SentinelAgent,
  action == SentinelAction::"execute_payment",
  resource is SentinelResource
) when {
  resource.type == "PaymentRail" &&
  resource.amount > 5000
};`,
    },
    {
      agentType: "hr-payroll",
      policyText: `permit(
  principal is SentinelAgent,
  action in [SentinelAction::"execute_payment", SentinelAction::"read_records"],
  resource is SentinelResource
) when {
  principal.agentType == "hr-payroll" &&
  principal.credentialStatus == "active" &&
  resource.domain in ["payroll", "benefits", "hr", "finance"]
};

forbid(
  principal is SentinelAgent,
  action == SentinelAction::"execute_payment",
  resource is SentinelResource
) when {
  resource.domain == "external"
};`,
    },
    {
      agentType: "financial-trading",
      policyText: `permit(
  principal is SentinelAgent,
  action in [SentinelAction::"book_flight", SentinelAction::"execute_payment"],
  resource is SentinelResource
) when {
  principal.agentType == "financial-trading" &&
  principal.credentialStatus == "active" &&
  resource.domain in ["trading", "crypto"]
};`,
    },
  ];

  let seededCount = 0;

  for (const agent of agents) {
    const r = await callContractWithAdmin("register-agent", agent);
    if (r.ok) {
      seededCount++;
      console.log(`[Seed] Contract agent: ${agent.agentDid}`);
    }
  }

  for (const policy of policies) {
    const r = await callContractWithAdmin("seed-policy", policy);
    if (r.ok) {
      seededCount++;
      console.log(`[Seed] Contract policy: ${policy.agentType}`);
    }
  }

  if (seededCount > 0) {
    console.log(`[Seed] TEE contract seeded successfully (${seededCount} operations).`);
    console.log("[Seed] Dashboard will use TEE contract for persistent storage.");
  } else {
    console.log("[Seed] TEE contract not reachable. Dashboard uses local storage (volatile).");
  }
}

async function start() {
  // Reset any stale state
  clearCache();
  clearAuditCache();

  // 1. Always seed local stores — this is the guarantee
  seedLocalStores();

  // 2. Try seeding the contract — if it works, great; if not, local fallback covers us
  try {
    await trySeedContract();
  } catch (err: any) {
    console.warn("[Seed] Contract seeding error (non-fatal):", err.message);
  }

  app.listen(PORT, () => {
    console.log(`\n[Oracle] Server running on http://localhost:${PORT}`);
    console.log(`[Oracle] Health: http://localhost:${PORT}/api/health`);
    console.log(`[Oracle] Compliance: POST http://localhost:${PORT}/api/compliance/check`);
    console.log(`[Oracle] Dashboard: http://localhost:${PORT}/dashboard (or :3000)`);
    console.log(`[Oracle] Mode: ${process.env.T3N_API_KEY ? "hybrid (contract + local)" : "local only"}`);
  });
}

start();

export default app;
