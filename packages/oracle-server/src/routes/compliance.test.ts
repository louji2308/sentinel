import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import complianceRouter from "./compliance.js";
import { registerAgent } from "../services/agentRegistry.js";
import { errorHandler } from "../middleware/errorHandler.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use("/api/compliance", complianceRouter);
app.use(errorHandler);

const FINANCE_AGENT = "did:t3n:finance-test";
const ROGUE_AGENT = "did:t3n:rogue-test";

registerAgent(FINANCE_AGENT, {
  did: FINANCE_AGENT,
  credentialType: "hr-payroll",
  credentialStatus: "active",
  credentialScope: ["spend:100000", "domain:payroll,benefits,hr,finance"],
  issuedAt: Math.floor(Date.now() / 1000) - 86400,
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
});

registerAgent(ROGUE_AGENT, {
  did: ROGUE_AGENT,
  credentialType: "financial-trading",
  credentialStatus: "active",
  credentialScope: ["spend:100", "domain:trading,crypto"],
  issuedAt: Math.floor(Date.now() / 1000) - 86400,
  expiresAt: Math.floor(Date.now() / 1000) + 86400,
});

describe("POST /api/compliance/check", () => {
  it("returns PERMIT for valid hr-payroll payment under cap", async () => {
    const res = await request(app)
      .post("/api/compliance/check")
      .send({
        agentDid: FINANCE_AGENT,
        proposedAction: {
          type: "execute_payment",
          resource: "FinanceSystem",
          amount: 10000,
          metadata: { domain: "finance" },
        },
        requestId: "e2e-permit-1",
        timestamp: Date.now(),
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe("PERMIT");
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.receiptId).toMatch(/^rcpt-/);
  });

  it("returns 400 for missing agentDid", async () => {
    const res = await request(app)
      .post("/api/compliance/check")
      .send({
        proposedAction: { type: "book_flight", resource: "TravelSystem", amount: 500 },
        requestId: "e2e-invalid-1",
        timestamp: Date.now(),
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid request body", async () => {
    const res = await request(app)
      .post("/api/compliance/check")
      .send({ invalid: true });

    expect(res.status).toBe(400);
  });

  it("returns DENY for rogue agent attempting finance payment", async () => {
    const res = await request(app)
      .post("/api/compliance/check")
      .send({
        agentDid: ROGUE_AGENT,
        proposedAction: {
          type: "execute_payment",
          resource: "FinanceSystem",
          amount: 500,
        },
        requestId: "e2e-deny-1",
        timestamp: Date.now(),
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe("DENY");
  });
});
