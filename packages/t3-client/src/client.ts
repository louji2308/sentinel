import {
  T3nClient,
  TenantClient,
  loadWasmComponent,
  setEnvironment,
  createEthAuthInput,
  eth_get_address,
  metamask_sign,
} from "@terminal3/t3n-sdk";

export type AuthenticatedClient = {
  client: T3nClient;
  did: string;
  address: string;
};

let wasmComponentCache: Awaited<ReturnType<typeof loadWasmComponent>> | null = null;

async function getWasmComponent() {
  if (!wasmComponentCache) {
    wasmComponentCache = await loadWasmComponent();
  }
  return wasmComponentCache;
}

export async function createAuthenticatedClient(
  privateKey: string,
  environment: "testnet" | "production" = (process.env.T3N_ENVIRONMENT as any) ?? "testnet"
): Promise<AuthenticatedClient> {
  setEnvironment(environment);

  const wasmComponent = await getWasmComponent();

  const address = eth_get_address(privateKey);

  const client = new T3nClient({
    wasmComponent,
    handlers: {
      EthSign: metamask_sign(address, undefined, privateKey),
    },
  });

  const handshakePromise = client.handshake();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("T3N handshake timed out after 10s")), 10_000)
  );
  await Promise.race([handshakePromise, timeoutPromise]);

  const authResult = await client.authenticate(createEthAuthInput(address));

  const did = authResult.did?.value ?? authResult.did;
  if (!did || !did.startsWith("did:t3n:")) {
    throw new Error(`Authentication produced invalid DID: ${JSON.stringify(did)}`);
  }

  console.log(`[T3 Client] Authenticated → ${did}`);
  return { client, did, address };
}

export async function createTenantClient(
  baseClient: AuthenticatedClient,
  tenantDid?: string,
  baseUrl?: string
): Promise<TenantClient> {
  const tenantClient = new TenantClient({
    environment: (process.env.T3N_ENVIRONMENT as any) ?? "testnet",
    t3n: baseClient.client,
    tenantDid,
    baseUrl,
  });
  return tenantClient;
}