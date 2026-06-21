# Bug Reports

> Part of the Terminal 3 Hackathon (June 9–22, 2026) submission.
>
> **Important:** This file contains two distinct categories of bugs:
> - **SDK Bug Reports (#1–#3, #20–#21)** — Issues in the Terminal 3 ADK/SDK itself, submitted to the bug bounty.
> - **Internal Bugs (Fixed)** — Bugs in Sentinel's own application code, discovered and fixed during development. Documented here as proof of engineering rigor for the "Best Agent" track. **Do not submit these to the bug bounty** — they are not SDK issues.

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

# Internal Bugs (Fixed)

> The following bugs were discovered in Sentinel's own application code during development and testing. They are documented here as proof of engineering rigor — each was found, fixed, and verified. They are **not** SDK bugs and should **not** be submitted to the bug bounty.

---

## 6. `spend_ledger` table missing `timestamp` column (FIXED)

**File:** `packages/oracle-server/src/services/db.ts`

**Root cause:** The `spend_ledger` table schema had no `timestamp` column, but `audit-velocity.ts` queried `WHERE timestamp > ?`. This would crash at runtime with `SQLITE_ERROR: no such column: timestamp`. Additionally, the `recordSpend` function did not store a timestamp, making time-window filtering impossible.

**Fix:** Added `timestamp INTEGER NOT NULL DEFAULT 0` column to the schema, updated `recordSpend` to store `MAX(timestamp, excluded.timestamp)` on upsert, and added a migration `ALTER TABLE` statement for existing databases (wrapped in try/catch for idempotence).

---

## 7. `audit-velocity.ts` references wrong column names (FIXED)

**File:** `packages/oracle-server/src/routes/audit-velocity.ts`

**Root cause:** The SQL queries referenced columns `bucket` and `agent_did` which do not exist in the `spend_ledger` table. The actual columns are `window_type` and `did`. All three queries would crash at runtime.

**Fix:** All column references corrected:
- `bucket` → `window_type` (3 occurrences)
- `agent_did` → `did` (2 occurrences)
- Result field access `r.bucket` → `r.window_type`

---

## 8. `compliance.rs` `record_spend()` never called from `evaluate()` (FIXED)

**File:** `contracts/sentinel-contract/src/compliance.rs`

**Root cause:** The `record_spend()` function was defined (line 370) but never called from the `evaluate()` function. Cumulative velocity tracking was a complete no-op in the TEE contract — spend was never persisted after a PERMIT decision.

**Fix:** Added `record_spend()` call inside `evaluate()` immediately after detecting a `Decision::Permit` and extracting the amount from the action input.

---

## 9. `Decision` enum output casing mismatch between contract and TS (FIXED)

**File:** `contracts/sentinel-contract/src/compliance.rs`

**Root cause:** The `Decision` enum derived `Debug` via `#[derive(Debug)]`, and `format!("{:?}", decision)` produced CamelCase variant names (`"Permit"`, `"Deny"`, `"Escalate"`). The TypeScript side expected `UPPER_CASE` (`"PERMIT"`, `"DENY"`, `"ESCALATE"`).

**Fix:** Implemented `std::fmt::Display for Decision` with explicit match arms producing uppercase output. Changed all `format!("{:?}", decision)` usages to `decision.to_string()` (3 occurrences).

---

## 10. Local fallback `spendCap` is hardcoded instead of parsed from agent scope (FIXED)

**File:** `packages/oracle-server/src/routes/compliance.ts`

**Root cause:** Line 63 computed `spendCap: agent.expiresAt ? 10000 : 1000`, which used the `expiresAt` timestamp as a boolean proxy (always truthy) and hardcoded the cap at $10,000 regardless of the agent's actual scope.

**Fix:** Added `parseSpendCap(scope: string[])` function that scans scope entries for `spend:<N>`, `spend:unlimited`, and extracts the actual cap. Falls back to $1,000 if no spend scope is declared.

---

## 11. `admin.ts` escalation APPROVE doesn't record spend in local fallback (FIXED)

**File:** `packages/oracle-server/src/routes/admin.ts`

**Root cause:** When an escalation was APPROVED via the admin API, the Rust contract's `resolve_escalation` correctly recorded the spend, but the TypeScript local fallback path in `admin.ts` did not call `recordSpend()` at all.

**Fix:** Added `recordSpend()` for all three windows (daily/hourly/weekly) in the `resolve-escalation` handler when decision is `APPROVE`.

---

## 12. `pollEscalation()` logic incorrectly assumes missing = approved (FIXED)

**File:** `packages/agents/src/agentBase.ts`

**Root cause:** The `pollEscalation()` function checked if the escalation was absent from the pending list and immediately returned `"approved"`. This was incorrect because the escalation could still be pending (not yet visible), was denied (and removed), or the API call failed silently.

**Fix:** Changed to query `/api/audit/stream` and look for a matching audit entry with `ESCALATION_APPROVE` or `ESCALATION_DENY` decision in the `policyClause` field. Now correctly returns `"approved"`, `"denied"`, or `"timeout"`.

---

## 13. `governance.ts` doesn't fire webhooks on escalation resolution (FIXED)

**File:** `packages/oracle-server/src/routes/governance.ts`

**Root cause:** The governance API route resolved escalations with direct SQL but never called `notifyEscalation()` or `notifySlack()`, creating inconsistency with the admin route.

**Fix:** Added `notifyEscalation()` and `notifySlack()` calls to the governance route's escalation resolution handler. Also added `recordSpend()` on APPROVE.

---

## 14. `sentinelContract.ts` circuit breaker never recovers (FIXED)

**File:** `packages/oracle-server/src/services/sentinelContract.ts`

**Root cause:** The `getTenantClient()` function cached `clientPromise` permanently. If the first T3N client initialization failed, `clientPromise` resolved to `null` and every subsequent call returned the same `null` without retrying.

**Fix:** When `getTenantClient()` fails, `clientPromise` is now set back to `null` so the next call creates a fresh client.

---

## 15. `package.json` dry-run script uses `require()` in ESM context (FIXED)

**File:** `package.json`

**Root cause:** The `dry-run` script used `require()` but the root `package.json` declares `"type": "module"`, making `require()` unavailable.

**Fix:** Replaced `require()` with dynamic `import()` ESM syntax.

---

## 16. No Zod validation on any API route (FIXED)

**Files:** `packages/oracle-server/src/routes/*.ts`

**Root cause:** All API routes accepted raw `req.body` without input validation. Malformed JSON could crash the server with uncaught exceptions.

**Fix:** Added Zod schemas for all route inputs with detailed field validation.

---

## 17. No graceful shutdown handler for Express server (FIXED)

**File:** `packages/oracle-server/src/index.ts`

**Root cause:** The Express server had no `SIGINT`/`SIGTERM` handler. Killing the process would abruptly close the SQLite database.

**Fix:** Added `gracefulShutdown()` function registered on `SIGINT` and `SIGTERM`.

---

## 18. No TypeScript config for oracle-server package (FIXED)

**File:** `packages/oracle-server/tsconfig.json` (created)

**Root cause:** The `packages/oracle-server/` had no `tsconfig.json`, so CI type-checking would not properly cover it.

**Fix:** Created `packages/oracle-server/tsconfig.json` with strict mode.

---

## 19. Diagnostic contract uses same WIT namespace as sentinel contract (FIXED)

**Files:** `contracts/diagnostic-contract/wit/world.wit`

**Root cause:** The diagnostic contract used the same WIT package namespace as the sentinel contract, causing type conflicts when building both in the same workspace.

**Fix:** Changed diagnostic contract to `package z:sentinel-diagnostic@0.1.0`.

---

## 20. Governance vote deduplication by `agentDid` alone (FIXED)

**File:** `packages/oracle-server/src/routes/governance.ts`

**Root cause:** Vote deduplication checked `agentDid` alone without scoping to `proposalId`, so an operator who voted on one proposal was blocked from voting on others.

**Fix:** Vote deduplication now checks `agentDid + proposalId` uniqueness within each proposal's vote list.

---

## 21. Admin audit log entries use verdicts not in `VerdictDecision` type (FIXED)

**File:** `packages/oracle-server/src/routes/admin.ts`

**Root cause:** Audit entries for escalation resolution used `ESCALATION_DENY`/`ESCALATION_APPROVE` verdicts that were not in the `VerdictDecision` type union.

**Fix:** Type union updated to include `ESCALATION_APPROVE`, `ESCALATION_DENY`, and other admin-specific verdict values.
