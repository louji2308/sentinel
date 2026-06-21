import "dotenv/config";
import { getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, createTenantClient } from "../packages/t3-client/src/client.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || "http://localhost:3001";

async function callOracle(endpoint: string, body: unknown) {
  const res = await fetch(`${ORACLE_URL}/api/admin/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${endpoint} failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function main() {
  console.log("[Seed] Seeding agents and policies via oracle server...\n");

  const now = Math.floor(Date.now() / 1000);
  const day = 86400;

  const agents = [
    {
      agentDid: "did:t3n:travel-agent-demo",
      credentialType: "travel-booking",
      credentialScope: ["spend:5000", "domain:flights,hotels,trains"],
      issuedAt: now - 7 * day,
      expiresAt: now + 30 * day,
    },
    {
      agentDid: "did:t3n:hr-payroll-demo",
      credentialType: "hr-payroll",
      credentialScope: ["spend:100000", "domain:payroll,benefits,hr,finance"],
      issuedAt: now - 7 * day,
      expiresAt: now + 30 * day,
    },
  ];

  for (const agent of agents) {
    try {
      const result = await callOracle("register-agent", agent);
      console.log(`  Agent ${agent.agentDid} -> OK`);
    } catch (err: any) {
      console.log(`  Agent ${agent.agentDid} -> ${err.message}`);
    }
  }

  console.log("\n[Seed] Seeding Cedar policies...\n");

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
  ];

  for (const policy of policies) {
    try {
      const result = await callOracle("seed-policy", policy);
      console.log(`  Policy ${policy.agentType} -> OK`);
    } catch (err: any) {
      console.log(`  Policy ${policy.agentType} -> ${err.message}`);
    }
  }

  console.log("\n[Seed] Complete!");
}

main().catch((err) => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
