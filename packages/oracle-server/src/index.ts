import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import complianceRouter from "./routes/compliance.js";
import auditRouter from "./routes/audit.js";
import auditVelocityRouter from "./routes/audit-velocity.js";
import adminRouter from "./routes/admin.js";
import governanceRouter from "./routes/governance.js";
import { registerAgent, clearCache } from "./services/agentRegistry.js";
import { clearCache as clearAuditCache, appendEntry } from "./services/auditLog.js";
import { callContractWithAdmin, isContractAvailable } from "./services/sentinelContract.js";
import { logger } from "./lib/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { rateLimiter } from "./middleware/rateLimit.js";
import { closeDb, periodicCleanup } from "./services/db.js";

const app = express();
const PORT = parseInt(process.env.ORACLE_PORT || "3001", 10);

app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(requestId);
app.use(pinoHttp({ logger, autoLogging: { ignore: req => req.url === "/api/health" } }));

app.use("/api/compliance", complianceRouter);
app.use("/api/audit", auditRouter);
app.use("/api/audit", auditVelocityRouter);
app.use("/api/admin", rateLimiter({ windowMs: 60000, max: 30 }), adminRouter);
app.use("/api/governance", rateLimiter({ windowMs: 60000, max: 20 }), governanceRouter);

setInterval(periodicCleanup, 60_000);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    uptime: process.uptime(),
    mode: isContractAvailable() ? "contract" : "local",
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

  for (const agent of agents) {
    registerAgent(agent.did, agent);
  }

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
}

async function trySeedContract() {
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
    if (r.ok) seededCount++;
  }

  for (const policy of policies) {
    const r = await callContractWithAdmin("seed-policy", policy);
    if (r.ok) seededCount++;
  }

  logger.info({ seededCount }, "Contract seeding complete");
}

async function start() {
  clearCache();
  clearAuditCache();

  seedLocalStores();

  try {
    await trySeedContract();
  } catch (err: unknown) {
    logger.warn({ err }, "Contract seeding skipped (non-fatal)");
  }

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, mode: process.env.T3N_API_KEY ? "hybrid" : "local" }, "Oracle server started");
  });

  function gracefulShutdown(signal: string) {
    logger.info({ signal }, "Shutting down gracefully");
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

app.use(errorHandler);

start();

export default app;
