import "dotenv/config";
import { T3nClient, loadWasmComponent, setEnvironment, createEthAuthInput, eth_get_address, metamask_sign } from "@terminal3/t3n-sdk";

const key = process.env.T3N_API_KEY!;
setEnvironment("testnet");

const wasm = await loadWasmComponent();
const address = eth_get_address(key);
console.log("Address:", address);

const client = new T3nClient({
  wasmComponent: wasm,
  handlers: { EthSign: metamask_sign(address, undefined, key) },
});

console.log("Handshake...");
const hs = await client.handshake();
console.log("Handshake done");

console.log("Authenticate...");
const auth = await client.authenticate(createEthAuthInput(address));
console.log("Auth result type:", typeof auth);
console.log("Auth keys:", Object.keys(auth));
console.log("Auth.did:", auth.did);
console.log("Full auth:", JSON.stringify(auth, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));

const did = auth.did?.value ?? auth.did;
console.log("Resolved DID:", did);
