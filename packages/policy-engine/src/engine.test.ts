import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "./engine.js";

describe("evaluatePolicy", () => {
  const principal = {
    did: "did:t3n:test-agent",
    credentialStatus: "active" as const,
    credentialType: "travel-booking",
    spendCap: 5000,
    credentialExpiresAt: Math.floor(Date.now() / 1000) + 86400,
  };

  const context = {
    hourOfDay: 14,
    dayOfWeek: "Mon",
    currentTimestamp: Math.floor(Date.now() / 1000),
    requestId: "test-req-1",
    spendDaily: 0,
    spendHourly: 0,
    spendCap: 5000,
  };

  it("permits valid travel-booking flight booking under cap", async () => {
    const result = await evaluatePolicy(
      principal,
      "book_flight",
      { type: "TravelSystem", domain: "travel", amount: 500 },
      context,
    );
    expect(result.decision).toBe("PERMIT");
    expect(result.matchedPolicyId).toBeTruthy();
  });

  it("escalates when amount + daily velocity exceeds 80% of cap", async () => {
    const nearCapContext = { ...context, spendDaily: 3800, spendHourly: 100 };
    const result = await evaluatePolicy(
      principal,
      "book_flight",
      { type: "TravelSystem", domain: "travel", amount: 500 },
      nearCapContext,
    );
    expect(result.decision).toBe("ESCALATE");
  });

  it("denies when amount exceeds spend cap", async () => {
    const result = await evaluatePolicy(
      principal,
      "book_flight",
      { type: "TravelSystem", domain: "travel", amount: 50000 },
      context,
    );
    expect(result.decision).toBe("DENY");
  });

  it("escalates when hourly burst exceeds threshold", async () => {
    const burstContext = { ...context, spendDaily: 100, spendHourly: 480, spendCap: 5000 };
    const result = await evaluatePolicy(
      principal,
      "book_flight",
      { type: "TravelSystem", domain: "travel", amount: 100 },
      burstContext,
    );
    expect(result.decision).toBe("ESCALATE");
  });

  it("denies when daily total exceeds 120% of cap", async () => {
    const overCapContext = { ...context, spendDaily: 6000, spendHourly: 500 };
    const result = await evaluatePolicy(
      principal,
      "book_flight",
      { type: "TravelSystem", domain: "travel", amount: 100 },
      overCapContext,
    );
    expect(result.decision).toBe("DENY");
  });
});
