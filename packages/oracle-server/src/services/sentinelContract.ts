import { getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, createTenantClient } from "@sentinel/t3-client";
import crypto from "crypto";

let clientPromise: Promise<any> | null = null;
let contractAvailable = false;
let lastFailureTime = 0;
let contractDownLogged = false;
const RETRY_INTERVAL_MS = 60_000;

function hasRequiredEnv(): boolean {
  return !!(
    process.env.T3N_API_KEY &&
    process.env.SENTINEL_TENANT_DID &&
    process.env.CONTRACT_TAIL &&
    process.env.CONTRACT_VERSION
  );
}

export function isContractAvailable(): boolean {
  return contractAvailable;
}

async function getTenantClient() {
  if (!clientPromise) {
    clientPromise = (async () => {
      try {
        const apiKey = process.env.T3N_API_KEY!;
        const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
        const tenantDid = process.env.SENTINEL_TENANT_DID!;
        const baseUrl = process.env.T3N_BASE_URL || getNodeUrl();
        const auth = await createAuthenticatedClient(apiKey, environment);
        const tc = await createTenantClient(auth, tenantDid, baseUrl);
        contractAvailable = true;
        return tc;
      } catch (err) {
        console.warn("[Contract] T3N client init failed — falling back to local storage:", (err as Error).message);
        contractAvailable = false;
        return null;
      }
    })();
  }
  return clientPromise;
}

export async function resetClient() {
  clientPromise = null;
  contractAvailable = false;
  lastFailureTime = 0;
  contractDownLogged = false;
}

function canonicalizeForSigning(input: Record<string, unknown>): string {
  const clone: Record<string, unknown> = {};
  const keys = Object.keys(input).filter((k) => k !== "signature").sort();
  for (const key of keys) clone[key] = input[key];
  return JSON.stringify(clone);
}

export function signAdminPayload(input: Record<string, unknown>, privateKeyHex: string): string {
  const canonical = canonicalizeForSigning(input);
  const hmac = crypto.createHmac("sha256", privateKeyHex);
  hmac.update(canonical, "utf-8");
  return hmac.digest("hex");
}

export async function callContract<T = unknown>(
  functionName: string,
  input: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  if (!hasRequiredEnv()) {
    return { ok: false, error: "T3N env vars not configured" };
  }

  // Circuit breaker: if contract recently failed, skip retry
  const now = Date.now();
  if (!contractAvailable && lastFailureTime > 0 && now - lastFailureTime < RETRY_INTERVAL_MS) {
    return { ok: false, error: "contract unavailable (circuit breaker)" };
  }

  try {
    const tc = await getTenantClient();
    if (!tc) {
      markContractDown();
      return { ok: false, error: "T3N client unavailable" };
    }

    const contractTail = process.env.CONTRACT_TAIL!;
    const contractVersion = process.env.CONTRACT_VERSION!;
    const result = await tc.contracts.execute(contractTail, {
      version: contractVersion,
      functionName,
      input,
    });

    // Success — mark available
    if (!contractAvailable) {
      contractAvailable = true;
      contractDownLogged = false;
      console.log("[Contract] TEE contract is now reachable — switching to contract-backed mode.");
    }

    return { ok: true, data: result as T };
  } catch (err: any) {
    markContractDown();
    const msg = err?.message || String(err);
    return { ok: false, error: msg };
  }
}

function markContractDown() {
  contractAvailable = false;
  if (lastFailureTime === 0) {
    lastFailureTime = Date.now();
  } else {
    const now = Date.now();
    if (now - lastFailureTime > RETRY_INTERVAL_MS) {
      lastFailureTime = now; // allow next retry window
    }
  }
  if (!contractDownLogged) {
    contractDownLogged = true;
    console.log("[Contract] TEE contract unreachable — switched to local storage. Will retry every 60s.");
  }
}

export async function callContractWithAdmin<T = unknown>(
  functionName: string,
  input: Record<string, unknown>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY || process.env.T3N_API_KEY || "dev-key";
  const signature = signAdminPayload(input, operatorKey);
  return callContract<T>(functionName, { ...input, signature });
}
