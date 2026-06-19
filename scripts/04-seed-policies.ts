import "dotenv/config";
import { getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, createTenantClient } from "../packages/t3-client/src/client.js";
import * as fs from "node:fs";
import * as path from "node:path";

async function main() {
  const apiKey = process.env.T3N_API_KEY;
  const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
  const tenantDid = process.env.SENTINEL_TENANT_DID;
  const contractTail = process.env.CONTRACT_TAIL;

  if (!apiKey) { throw new Error("T3N_API_KEY not set in .env"); }
  if (!contractTail) { throw new Error("CONTRACT_TAIL not set in .env"); }

  const baseUrl = process.env.T3N_BASE_URL || getNodeUrl();
  const authClient = await createAuthenticatedClient(apiKey, environment);
  const tenantClient = await createTenantClient(authClient, tenantDid, baseUrl);

  const kvTail = `${contractTail}-kv`;

  async function setKvEntry(key: string, value: string) {
    const payload = {
      tail: kvTail,
      version: process.env.CONTRACT_VERSION || "0.1.0",
      functionName: "kv-set",
      input: { key, value },
    };
    try {
      const result = await tenantClient.contracts.execute(kvTail, {
        version: payload.version,
        functionName: payload.functionName,
        input: payload.input,
      });
      console.log(`  ${key} → OK`);
    } catch (err: any) {
      console.log(`  ${key} → ${err.message || "failed"}`);
    }
  }

  console.log("[Seed] Seeding agent registry entries into KV store...\n");

  const agents = [
    {
      did: "did:t3n:travel-agent-demo",
      type: "travel-booking",
      scope: ["spend:5000", "domain:flights,hotels,trains"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 30,
    },
    {
      did: "did:t3n:hr-payroll-demo",
      type: "hr-payroll",
      scope: ["spend:100000", "domain:payroll,benefits,hr"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 30,
    },
    {
      did: "did:t3n:rogue-agent-demo",
      type: "financial-trading",
      scope: ["spend:100", "domain:trading,crypto"],
      issuedAt: Date.now(),
      expiresAt: Date.now() + 86400000 * 30,
    },
  ];

  for (const agent of agents) {
    const key = `agent:${agent.did}`;
    const value = JSON.stringify(agent);
    await setKvEntry(key, value);
  }

  console.log("\n[Seed] Seeding Cedar policies...\n");

  const policyDir = path.resolve("packages/policy-engine/src/policies");
  if (fs.existsSync(policyDir)) {
    const files = fs.readdirSync(policyDir).filter(f => f.endsWith(".cedar"));
    for (const file of files) {
      const policyText = fs.readFileSync(path.join(policyDir, file), "utf-8");
      const agentType = file.replace(".cedar", "");
      const key = `policy:${agentType}`;
      await setKvEntry(key, policyText);
    }
  }

  console.log("\n[Seed] Complete!");
}

main().catch((err) => {
  console.error("[Seed] Fatal error:", err);
  process.exit(1);
});
