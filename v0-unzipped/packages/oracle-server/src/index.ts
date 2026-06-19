import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import complianceRouter from "./routes/compliance.js";
import auditRouter from "./routes/audit.js";
import adminRouter from "./routes/admin.js";
import { registerAgent } from "./services/agentRegistry.js";

const app = express();
const PORT = parseInt(process.env.ORACLE_PORT || "3001", 10);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/compliance", complianceRouter);
app.use("/api/audit", auditRouter);
app.use("/api/admin", adminRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

function seedDemoAgents() {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  registerAgent("did:t3n:travel-agent-demo", {
    did: "did:t3n:travel-agent-demo",
    credentialScope: ["travel", "booking"],
    credentialStatus: "active",
    credentialType: "travel-booking",
    issuedAt: now - 7 * day,
    expiresAt: now + 30 * day,
  });

  registerAgent("did:t3n:hr-payroll-demo", {
    did: "did:t3n:hr-payroll-demo",
    credentialScope: ["finance", "hr", "payroll"],
    credentialStatus: "active",
    credentialType: "hr-payroll",
    issuedAt: now - 7 * day,
    expiresAt: now + 30 * day,
  });

  registerAgent("did:t3n:rogue-agent-demo", {
    did: "did:t3n:rogue-agent-demo",
    credentialScope: [],
    credentialStatus: "active",
    credentialType: "unverified",
    issuedAt: now - 1 * day,
    expiresAt: now + 1 * day,
  });
}

seedDemoAgents();

app.listen(PORT, () => {
  console.log(`[Oracle] Server running on http://localhost:${PORT}`);
  console.log(`[Oracle] Health: http://localhost:${PORT}/api/health`);
  console.log(`[Oracle] Compliance: POST http://localhost:${PORT}/api/compliance/check`);
});

export default app;