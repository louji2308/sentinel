import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, createTenantClient } from "../packages/t3-client/src/client.js";

async function main() {
  const apiKey = process.env.T3N_API_KEY;
  const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
  const tenantDid = process.env.SENTINEL_TENANT_DID;
  const contractTail = process.env.CONTRACT_TAIL;
  const contractVersion = process.env.CONTRACT_VERSION;

  if (!apiKey) { throw new Error("T3N_API_KEY not set in .env"); }
  if (!contractTail || !contractVersion) { throw new Error("CONTRACT_TAIL and CONTRACT_VERSION must be set in .env"); }

  const wasmPath = path.resolve("contracts/sentinel-contract/target/wasm32-wasip2/release/sentinel_compliance.wasm");
  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM binary not found at ${wasmPath}. Run 'cargo build --target wasm32-wasip2 --release' first.`);
  }
  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`[Deploy] Loading WASM: ${wasmPath} (${wasmBytes.length} bytes)`);

  console.log("[Deploy] Authenticating with T3N...");
  const authClient = await createAuthenticatedClient(apiKey, environment);

  const baseUrl = process.env.T3N_BASE_URL || getNodeUrl();
  const tenantClient = await createTenantClient(authClient, tenantDid, baseUrl);

  console.log(`[Deploy] Publishing contract: ${contractTail}@${contractVersion}...`);
  const publishResult = await tenantClient.contracts.publish({
    tail: contractTail,
    version: contractVersion,
    wasm: new Uint8Array(wasmBytes),
  });
  console.log("[Deploy] Publish result:", JSON.stringify(publishResult, null, 2));

  console.log("[Deploy] Registering contract...");
  const registerResult = await tenantClient.contracts.register({
    tail: contractTail,
    version: contractVersion,
    wasm: new Uint8Array(wasmBytes),
  });
  console.log("[Deploy] Register result:", JSON.stringify(registerResult, null, 2));

  console.log("\n[Deploy] Complete!");
  console.log(`  Contract : ${contractTail}@${contractVersion}`);
  console.log(`  WASM size: ${wasmBytes.length} bytes`);
}

main().catch((err) => {
  console.error("[Deploy] Fatal error:", err);
  process.exit(1);
});
