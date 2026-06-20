import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import complianceRouter from "./routes/compliance.js";
import auditRouter from "./routes/audit.js";
import adminRouter from "./routes/admin.js";
import { callContractWithAdmin, resetClient } from "./services/sentinelContract.js";

const app = express();
const PORT = parseInt(process.env.ORACLE_PORT || "3001", 10);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api/compliance", complianceRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

async function seedDemoAgents() {
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
      policyText: `// Cedar policy for travel-booking agents
permit(
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
      policyText: `// Cedar policy for hr-payroll agents
permit(
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
      policyText: `// Cedar policy for financial-trading agents
permit(
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

  for (const agent of agents) {
    try {
      await callContractWithAdmin("register-agent", agent);
      console.log(`[Seed] Registered agent: ${agent.agentDid}`);
    } catch (err: any) {
      console.warn(`[Seed] Agent ${agent.agentDid} skipped: ${err.message}`);
    }
  }

  for (const policy of policies) {
    try {
      await callContractWithAdmin("seed-policy", policy);
      console.log(`[Seed] Seeded policy: ${policy.agentType}`);
    } catch (err: any) {
      console.warn(`[Seed] Policy ${policy.agentType} skipped: ${err.message}`);
    }
  }

  console.log("[Seed] Demo agents and policies seeded.");
}

async function start() {
  try {
    await seedDemoAgents();
  } catch (err: any) {
    console.warn("[Seed] Seeding failed (contract may not be deployed yet):", err.message);
    console.warn("[Seed] Run 'npm run deploy:contract && npm run seed:policies' to set up the contract.");
  }

  app.listen(PORT, () => {
    console.log(`[Oracle] Server running on http://localhost:${PORT}`);
    console.log(`[Oracle] Health: http://localhost:${PORT}/api/health`);
    console.log(`[Oracle] Compliance: POST http://localhost:${PORT}/api/compliance/check`);
  });
}

start();

export default app;
