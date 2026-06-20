import { getNodeUrl } from "@terminal3/t3n-sdk";
import { createAuthenticatedClient, createTenantClient } from "@sentinel/t3-client";
import crypto from "crypto";

let clientPromise: ReturnType<typeof createTenantClient> | null = null;

function getConfig() {
  const apiKey = process.env.T3N_API_KEY;
  const environment = (process.env.T3N_ENVIRONMENT ?? "testnet") as "testnet" | "production";
  const tenantDid = process.env.SENTINEL_TENANT_DID;
  const contractTail = process.env.CONTRACT_TAIL;
  const contractVersion = process.env.CONTRACT_VERSION;
  const operatorKey = process.env.OPERATOR_PRIVATE_KEY || apiKey;

  if (!apiKey) throw new Error("T3N_API_KEY not set in .env");
  if (!tenantDid) throw new Error("SENTINEL_TENANT_DID not set in .env");
  if (!contractTail) throw new Error("CONTRACT_TAIL not set in .env");
  if (!contractVersion) throw new Error("CONTRACT_VERSION not set in .env");

  return { apiKey, environment, tenantDid, contractTail, contractVersion, operatorKey };
}

async function getTenantClient() {
  if (!clientPromise) {
    const { apiKey, environment, tenantDid } = getConfig();
    const baseUrl = process.env.T3N_BASE_URL || getNodeUrl();
    const auth = await createAuthenticatedClient(apiKey, environment);
    clientPromise = createTenantClient(auth, tenantDid, baseUrl);
  }
  return clientPromise;
}

export async function resetClient() {
  clientPromise = null;
}

/**
 * Canonicalizes a payload for signing.
 *
 * Strips any existing `signature` field (added after signing), then produces
 * a stable JSON string with sorted keys to match serde_json serialization
 * on the contract side.
 */
function canonicalizeForSigning(input: Record<string, unknown>): string {
  const clone: Record<string, unknown> = {};
  const keys = Object.keys(input).filter((k) => k !== "signature").sort();
  for (const key of keys) {
    clone[key] = input[key];
  }
  return JSON.stringify(clone);
}

/**
 * Signs an admin payload using HMAC-SHA256 with the operator private key.
 *
 * In production with a TEE that supports ECDSA/secp256k1, replace this with
 * Ethereum personal_sign (EIP-191) matching the TEE host's signing::verify interface.
 * The HMAC approach works for development/demo when no operator public key is stored
 * in the contract (dev mode skips signature verification).
 */
export function signAdminPayload(input: Record<string, unknown>, privateKeyHex: string): string {
  const canonical = canonicalizeForSigning(input);
  const hmac = crypto.createHmac("sha256", privateKeyHex);
  hmac.update(canonical, "utf-8");
  return hmac.digest("hex");
}

export async function callContract<T = unknown>(
  functionName: string,
  input: unknown,
): Promise<T> {
  const { contractTail, contractVersion } = getConfig();
  const tc = await getTenantClient();
  const result = await tc.contracts.execute(contractTail, {
    version: contractVersion,
    functionName,
    input,
  });
  return result as T;
}

export async function callContractWithAdmin<T = unknown>(
  functionName: string,
  input: Record<string, unknown>,
): Promise<T> {
  const { operatorKey } = getConfig();
  const signature = signAdminPayload(input, operatorKey);
  const signed = { ...input, signature };
  return callContract<T>(functionName, signed);
}
