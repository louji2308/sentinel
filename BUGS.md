# Bug Reports

> Part of the Terminal 3 Hackathon (June 9–22, 2026) submission.
>
> **Important:** Contains only SDK bug reports for the bug bounty. Internal bugs found and fixed during development have been removed from this file.

---

# SDK Bug Reports

---

## 1. Contract execution fails with `HTTP 500: Internal error` on T3N testnet

### Description
Every attempt to execute a deployed WASM contract on the T3N testnet returns an opaque `HTTP 500: Internal error` from the node. The error occurs at the WASM instantiation stage, before any contract-specific function logic runs.

### Environment
| Key | Value |
|-----|-------|
| T3N SDK | `@terminal3/t3n-sdk@3.9.0` |
| T3N node | `https://cn-api.sg.testnet.t3n.terminal3.io` |
| Rust | `1.96.0` |
| Target | `wasm32-wasip2` |
| wit-bindgen | `0.49.0` |
| wit-component | `0.243.0` |

### Steps to reproduce
1. Build a WASM component targeting the T3N `contracts` world:
   ```bash
   cargo build --target wasm32-wasip2 --release
   ```
2. Register the contract via `tenant.contracts.register()`.
3. Execute any function via `tenant.contracts.execute()`.

### Expected behavior
The contract function executes and returns a result (or a contract-authored error).

### Actual behavior
All execution calls return:
```
HTTP 500: Internal error [<uuid>] ({"code":"internal_error","request_id":"<uuid>"})
```

### Evidence
The error has been reproduced with:
- The full Sentinel compliance contract (322 KB, with host imports)
- A minimal `ping` contract (40 KB, with the same 5 host imports)
- A minimal `ping` contract with **zero host imports** (40 KB, no `deps/`)
- Multiple contract versions (`1.0.0` through `1.0.5`)
- Multiple function names (including a non-existent name)
- Both `TenantContractsNamespace.execute()` and raw `T3nClient.executeAndDecode()`
- SDK versions `3.8.0` and `3.9.0`
- `wit-bindgen` versions `0.49.0` and `0.35.0`
- Clean rebuilds from scratch

All paths converge to the same `HTTP 500: Internal error`.

### Root cause (suspected)
Server-side crash during WASM component instantiation. The WASM binary uses Component Model encoding (version `0x0001000d`), and the T3N runtime may not support this encoding version or may have a bug in its WASM loader. The error is not listed in the [T3N common errors](https://docs.terminal3.io/developers/adk/tips/common-errors) documentation.

### Impact
Blocking — the contract cannot execute any function, making the compliance pipeline non-functional on T3N testnet. `seed:policies`, `register-agent`, and all compliance evaluations all depend on contract execution.

### Mitigation attempts (exhausted)

| Attempt | Result |
|---------|--------|
| All SDK versions (3.8.0, 3.9.0) | Same error |
| All wit-bindgen versions (0.35.0, 0.49.0) | Same error |
| Minimal contract with zero imports | Same error |
| Non-existent function name (probes server vs loader) | Same error |
| WIT interface versions downgraded to `@1.0.0` | Compiles, same error |
| Component Model vs core module encoding | Binary is valid Component (`0x0001000d`) |

### Recommended next steps for T3N team

1. **Check testnet node for WASM Component Model support.** The binary encoding `0x0001000d` indicates a WASM Component (not a core module). If the runtime's WASM loader only supports core modules (wasip1), the node would reject valid Component binaries at instantiation time. Confirming `wasm32-wasip2` Component Model support on the testnet node would resolve this.
2. **Try wasm32-wasip1** as a fallback target if the runtime does not support Component Model encoding.
3. **Try a second region/node** — if `T3N_BASE_URL` supports alternate nodes, test whether a different node URL behaves differently.
4. **Check server-side logs** for the request IDs below — the error is opaque to the client, but the node's internal logs would pinpoint the instantiation failure.

### Status
Unresolved. Requires investigation by the T3N team.

### Escalation contacts
- **Telegram:** [t.me/terminal3developer](https://t.me/terminal3developer)
- **Email:** devrel@terminal3.io
- **Reference:** Request ID `8cc8c8d9-fa35-4da6-94fa-34de6185c581`

### Request IDs (for T3N support)
| ID | Test |
|----|------|
| `f95cda50-9474-4bd9-96c2-48086b7f2afa` | Demo — Book flight $500 |
| `597aa095-64f3-48ef-8be3-280519f030f8` | Demo — Search flights |
| `adbea262-97bb-44e9-8e08-89c1d00de81d` | Demo — Book flight $9,000 (escalate) |
| `3a511c76-ce00-48ce-a3d3-f886ee0c6e36` | Demo — Execute payment $15,000 |
| `cc9d015f-69cd-4e8c-b658-0b88e44c8707` | `verify-receipt` standalone |
| `8cc8c8d9-fa35-4da6-94fa-34de6185c581` | Minimal contract (SDK v3.9.0) |
| `aa97bafa-0a28-4dcb-8f8c-a84f7cbca2f5` | Sentinel v1.0.5 via `T3nClient.executeAndDecode` |
| `4adc5d05-2772-4169-95b1-9d61445102d5` | Minimal contract with host imports |
| `6fff6aa3-6625-4f4d-b34c-c92da7055071` | Minimal contract with zero imports |

---

## 2. Missing agent-registration primitive in ADK contract scaffolding

### Description
The standard T3 ADK contract template/pattern has no `register-agent` export. New developers following the examples will inevitably write agent registration data to a disconnected KV template contract (via `contracts.execute()` with `kv-set`) rather than into their contract's own internal `kv_store` namespace. The documentation assumes the developer knows to bridge these two patterns, but provides no guidance on how or why.

### Impact
Medium. Forces developers to reverse-engineer the two KV paths before they can write a simple agent registry. Increases the likelihood of silent write-to-wrong-namespace bugs.

### Suggested fix
Either:
- Add a `register-agent` export to the standard contract scaffolding (same pattern as `kv-set`/`kv-get`), or
- Add a documentation section explaining the two KV patterns with a worked example.

### Status
Confirmed. Requires documentation improvement or a scaffolding change.

---

## 3. Documentation ambiguity: `contracts.execute()` KV contracts vs. component-internal `kv-store`

### Description
The SDK documentation does not clearly distinguish between:
1. A KV-template contract deployed separately and addressed via `tenant.contracts.execute("some-tail-kv", { functionName: "kv-set", input })`.
2. The `host:interfaces/kv-store` namespace available inside a component's own WASM execution (accessed via `kv_store::set()` in Rust).

These are two completely different storage paths with different key namespaces, map naming conventions, and access patterns. The documentation presents them without explaining the distinction, which leads to the "silent write to wrong namespace" bug pattern.

### Impact
Medium. Affects any developer writing a contract that needs to read seed data or share state between the deployment script and the contract's runtime.

### Suggested fix
Add a "KV Store: Two Paths" section to the ADK documentation with:
- A diagram showing the two paths
- When to use each one
- The key naming convention for each path
- A working example of writing data from a deployment script and reading it inside a contract

### Status
Confirmed. Requires documentation clarification.

---

## 4. `T3nClient.handshake()` has no built-in timeout and can hang indefinitely

### Description
`client.handshake()` returns a Promise that can hang indefinitely when the T3N node is unreachable or slow to respond. The SDK provides no built-in timeout parameter and no documented timeout behavior. Application code must wrap every handshake call in a `Promise.race` with a timeout to prevent hung connections.

### Files
- `@terminal3/t3n-sdk`: `T3nClient.handshake()` method
- Workaround in this repo: `packages/t3-client/src/client.ts:45-49`

### Reproduction
```typescript
const client = new T3nClient({ ... });
await client.handshake(); // Hangs indefinitely if node is unreachable
```

### Impact
Medium. In production agent systems, an unresponsive handshake blocks the entire startup sequence. The circuit breaker pattern in `sentinelContract.ts` cannot distinguish between "node is down" and "handshake is still waiting" — both look like a hanging promise.

### Suggested fix
Add an optional `timeout` parameter (default 30s) to `client.handshake()` with clear documentation. Alternatively, document the default behavior so developers know to add their own timeout wrapper.

### Status
Open. Workaround implemented in this repo (10s timeout race).

---

## 5. `client.authenticate()` return type is not clearly typed

### Description
The return value of `client.authenticate(createEthAuthInput(address))` is not a well-defined TypeScript type. Based on testing, it can return:
- A `Uint8Array` (raw bytes)
- An object with `.value` (string)
- An object with `.did.value` (string)
- A plain string

The SDK type definition does not document which shape is returned, forcing defensive runtime checks on every authentication call.

### Files
- `@terminal3/t3n-sdk`: `T3nClient.authenticate()` method  
- Workaround in this repo: `packages/t3-client/src/client.ts:53-55`

### Reproduction
```typescript
const result = await client.authenticate(createEthAuthInput(address));
// TypeScript infers 'unknown' or a poor union type
// Developer must manually extract the DID with fallbacks:
const did = result instanceof Uint8Array
  ? new TextDecoder().decode(result)
  : result?.value ?? result?.did?.value ?? String(result);
```

### Impact
Low (easy to work around) but indicates a documentation/typing gap in the SDK. A clearly typed return would eliminate the defensive code and reduce the risk of silent DID extraction errors.

### Suggested fix
Type the return of `authenticate()` as a discriminated union or a well-documented type with a `did: string` field. Document the exact shape so TypeScript consumers can extract the DID without runtime probing.

### Status
Open. Workaround implemented in this repo.

---

