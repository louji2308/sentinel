import "dotenv/config";
import { createAuthenticatedClient, createTenantClient } from "../packages/t3-client/src/client.js";

async function main() {
  const apiKey = process.env.T3N_API_KEY;
  const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
  const existingDid = process.env.SENTINEL_TENANT_DID;
  const contractTail = process.env.CONTRACT_TAIL;
  const contractVersion = process.env.CONTRACT_VERSION;

  if (!apiKey) {
    throw new Error("T3N_API_KEY not set in .env");
  }
  if (!contractTail || !contractVersion) {
    throw new Error("CONTRACT_TAIL and CONTRACT_VERSION must be set in .env");
  }

  console.log("[Setup] Authenticating with T3N...");
  const authClient = await createAuthenticatedClient(apiKey, environment);

  let tenantDid = existingDid;

  const tenantClient = await createTenantClient(authClient, tenantDid);

  console.log("[Setup] Checking tenant status...");
  try {
    const claimResult: any = await (tenantClient as any).tenant.claim();
    console.log("[Setup] Tenant claim result:", JSON.stringify(claimResult, null, 2));
    if (claimResult?.tenant) {
      tenantDid = claimResult.tenant;
      console.log(`[Setup] Tenant claimed: ${tenantDid}`);
    }
  } catch (err: any) {
    if (
      err.message?.includes?.("already") ||
      err.message?.includes?.("Already") ||
      err.message?.includes?.("admit") ||
      err.message?.includes?.("exists")
    ) {
      console.log("[Setup] Tenant already claimed — using existing DID from .env");
    } else {
      console.log("[Setup] Tenant claim unavailable (expected on previously-claimed tenants):", err.message);
      if (existingDid) {
        console.log("[Setup] Falling back to SENTINEL_TENANT_DID from .env");
      } else {
        throw new Error("No tenant DID available and claim failed. Set SENTINEL_TENANT_DID in .env or fix the API key.");
      }
    }
  }

  if (!tenantDid) {
    throw new Error("Unable to determine tenant DID");
  }

  console.log(`[Setup] Tenant DID: ${tenantDid}`);

  try {
    const meResult: any = await (tenantClient as any).tenant.me();
    console.log("[Setup] Tenant info:", JSON.stringify(meResult, null, 2));
  } catch (err: any) {
    console.log("[Setup] tenant.me() not available:", err.message);
  }

  const kvTail = `${contractTail}-kv`;

  console.log(`[Setup] Creating KV map: ${kvTail}...`);
  try {
    const createResult: any = await (tenantClient as any).maps.create({
      tail: kvTail,
      visibility: "public",
      writers: "all",
    });
    console.log("[Setup] KV map created:", JSON.stringify(createResult, null, 2));
  } catch (err: any) {
    if (err.message?.includes?.("already exists") || err.message?.includes?.("ALREADY_EXISTS")) {
      console.log("[Setup] KV map already exists — skipping creation");
    } else {
      console.log("[Setup] Warning: could not create KV map:", err.message);
    }
  }

  console.log("\n[Setup] Complete!");
  console.log(`  Tenant DID : ${tenantDid}`);
  console.log(`  Contract   : ${contractTail}@${contractVersion}`);
  console.log(`  KV Map     : ${kvTail}`);
  console.log(`  Address    : ${authClient.address}`);
}

main().catch((err) => {
  console.error("[Setup] Fatal error:", err);
  process.exit(1);
});