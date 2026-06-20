# Bugs

> Part of the hackathon submission — all known bugs are documented here.

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
- The full Sentinel compliance contract (`322 KB`, with host imports)
- A minimal `ping` contract (`40 KB`, with the same 5 host imports)
- A minimal `ping` contract with **zero host imports** (`40 KB`, no `deps/`)
- Multiple contract versions (`1.0.0` through `1.0.5`)
- Multiple function names (including a non-existent name)
- Both `TenantContractsNamespace.execute()` and raw `T3nClient.executeAndDecode()`
- SDK versions `3.8.0` and `3.9.0`
- `wit-bindgen` versions `0.49.0` and `0.35.0`
- Clean rebuilds from scratch

All paths converge to the same `HTTP 500: Internal error`.

### Root cause (suspected)
Server-side crash during WASM component instantiation. The WASM binary uses Component Model encoding (`version 0x0001000d`), and the T3N runtime may not support this encoding version or may have a bug in its WASM loader. The error is not listed in the [T3N common errors](https://docs.terminal3.io/developers/adk/tips/common-errors) documentation.

### Impact
Blocking — the contract cannot execute any function, making the compliance pipeline non-functional on T3N testnet. `seed:policies`, `register-agent`, and all compliance evaluations all depend on contract execution.

### Status
Unresolved. Requires investigation by the T3N team. Contact [t.me/terminal3developer](https://t.me/terminal3developer) with request ID `8cc8c8d9-fa35-4da6-94fa-34de6185c581`.

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

The standard T3 ADK contract template/pattern has no `register-agent` export. New developers following the examples will inevitably write agent registration data to a disconnected KV template contract (via `contracts.execute()` with `kv-set`) rather than into their contract's own internal `kv_store` namespace. The documentation assumes the developer knows to bridge these two patterns, but provides no guidance on how or why.

### Status
Confirmed. Requires documentation improvement or a scaffolding change.

---

## 3. Documentation ambiguity: `contracts.execute()` KV contracts vs. component-internal `kv-store`

The SDK documentation does not clearly distinguish between:
1. A KV-template contract deployed separately and addressed via `tenant.contracts.execute("some-tail-kv", { functionName: "kv-set", input })`.
2. The `host:interfaces/kv-store` namespace available inside a component's own WASM execution (accessed via `kv_store::set()` in Rust).

These are two completely different storage paths with different key namespaces, map naming conventions, and access patterns. The documentation presents them without explaining the distinction, which leads to the "silent write to wrong namespace" bug pattern.

### Status
Confirmed. Requires documentation clarification.

---

## 4. `spend_ledger` table missing `timestamp` column (FIXED)

**File:** `packages/oracle-server/src/services/db.ts`

**Root cause:** The `spend_ledger` table schema had no `timestamp` column, but `audit-velocity.ts` queried `WHERE timestamp > ?`. This would crash at runtime with `SQLITE_ERROR: no such column: timestamp`. Additionally, the `recordSpend` function did not store a timestamp, making time-window filtering impossible.

**Fix:** Added `timestamp INTEGER NOT NULL DEFAULT 0` column to the schema, updated `recordSpend` to store `MAX(timestamp, excluded.timestamp)` on upsert, and added a migration `ALTER TABLE` statement for existing databases (wrapped in try/catch for idempotence).

---

## 5. `audit-velocity.ts` references wrong column names (FIXED)

**File:** `packages/oracle-server/src/routes/audit-velocity.ts`

**Root cause:** The SQL queries referenced columns `bucket` and `agent_did` which do not exist in the `spend_ledger` table. The actual columns are `window_type` and `did`. All three queries would crash at runtime.

**Fix:** All column references corrected:
- `bucket` → `window_type` (3 occurrences)
- `agent_did` → `did` (2 occurrences)
- Result field access `r.bucket` → `r.window_type`

---

## 6. `compliance.rs` `record_spend()` never called from `evaluate()` (FIXED)

**File:** `contracts/sentinel-contract/src/compliance.rs`

**Root cause:** The `record_spend()` function was defined (line 370) but never called from the `evaluate()` function. Cumulative velocity tracking was a complete no-op in the TEE contract — spend was never persisted after a PERMIT decision. The TS local fallback was also affected because the contract was the authoritative source.

**Fix:** Added `record_spend()` call inside `evaluate()` immediately after detecting a `Decision::Permit` and extracting the amount from the action input.

---

## 7. `Decision` enum output casing mismatch between contract and TS (FIXED)

**File:** `contracts/sentinel-contract/src/compliance.rs`

**Root cause:** The `Decision` enum derived `Debug` via `#[derive(Debug)]`, and `format!("{:?}", decision)` produced CamelCase variant names (`"Permit"`, `"Deny"`, `"Escalate"`). The TypeScript side expected `UPPER_CASE` (`"PERMIT"`, `"DENY"`, `"ESCALATE"`). When the contract became reachable, all decisions would have wrong casing in the API response, breaking the dashboard and agent code.

**Fix:** Implemented `std::fmt::Display for Decision` with explicit match arms producing uppercase output. Changed all `format!("{:?}", decision)` usages to `decision.to_string()` (3 occurrences).

---

## 8. Local fallback `spendCap` is hardcoded instead of parsed from agent scope (FIXED)

**File:** `packages/oracle-server/src/routes/compliance.ts`

**Root cause:** Line 63 computed `spendCap: agent.expiresAt ? 10000 : 1000`, which used the `expiresAt` timestamp as a boolean proxy (always truthy for any valid agent) and hardcoded the cap at $10,000 regardless of the agent's actual scope (e.g., `spend:5000` in the travel agent's scope). The `engine.ts` policy engine used this cap for velocity checks, making it always $10,000 per agent.

**Fix:** Added `parseSpendCap(scope: string[])` function that scans scope entries for `spend:<N>`, `spend:unlimited`, and extracts the actual cap. Falls back to $1,000 if no spend scope is declared.

---

## 9. `admin.ts` escalation APPROVE doesn't record spend in local fallback (FIXED)

**File:** `packages/oracle-server/src/routes/admin.ts`

**Root cause:** When an escalation was APPROVED via the admin API, the Rust contract's `resolve_escalation` correctly recorded the spend (line 571-580 in compliance.rs), but the TypeScript local fallback path in `admin.ts` did not call `recordSpend()` at all. This caused a data desync between contract mode and local mode — spend from approved escalations would only appear in contract mode.

**Fix:** Added `recordSpend()` for all three windows (daily/hourly/weekly) in the `resolve-escalation` handler when decision is `APPROVE`.

---

## 10. `pollEscalation()` logic incorrectly assumes missing = approved (FIXED)

**File:** `packages/agents/src/agentBase.ts`

**Root cause:** The `pollEscalation()` function checked if the escalation was absent from the pending list and immediately returned `"approved"`. This was incorrect because the escalation could still be pending (not yet visible), was denied (and removed), or the API call failed silently. It also used `/api/governance/escalations` which only returns pending escalations, making it impossible to distinguish "approved" from "denied".

**Fix:** Changed to query `/api/audit/stream` and look for a matching audit entry with `ESCALATION_APPROVE` or `ESCALATION_DENY` decision in the `policyClause` field. Now correctly returns `"approved"`, `"denied"`, or `"timeout"`.

---

## 11. `governance.ts` doesn't fire webhooks on escalation resolution (FIXED)

**File:** `packages/oracle-server/src/routes/governance.ts`

**Root cause:** The governance API route (used by the dashboard's EscalationsPanel) resolved escalations with direct SQL but never called `notifyEscalation()` or `notifySlack()`. The admin API route (`admin.ts`) correctly fired both, creating inconsistency: escalations resolved via the dashboard received no webhook notification.

**Fix:** Added `notifyEscalation()` and `notifySlack()` calls to the governance route's escalation resolution handler. Also added `recordSpend()` on APPROVE (same fix as Bug #9).

---

## 12. `sentinelContract.ts` circuit breaker never recovers (FIXED)

**File:** `packages/oracle-server/src/services/sentinelContract.ts`

**Root cause:** The `getTenantClient()` function cached `clientPromise` permanently. If the first T3N client initialization failed, `clientPromise` resolved to `null` and every subsequent call returned the same `null` without retrying. The circuit breaker's `RETRY_INTERVAL_MS` (60s) appeared to retry but always received the same failed promise. The system was permanently stuck in "contract unavailable" mode until server restart.

**Fix:** When `getTenantClient()` fails, `clientPromise` is now set back to `null` so the next call creates a fresh client. The `markContractDown()` logic was simplified: `lastAttemptTime` is set before every attempt, and `contractAvailable` is only set to `true` on success. The circuit breaker uses `lastAttemptTime` to rate-limit retries to once per 60s, but each retry creates a fresh client attempt.

---

## 13. `package.json` dry-run script uses `require()` in ESM context (FIXED)

**File:** `package.json`

**Root cause:** The `dry-run` script used `require()` to import the simulator module:
```
"dry-run": "tsx -e \"const { runDryRun } = require(...)\""
```
Since the root `package.json` declares `"type": "module"`, `require()` is not available in the ESM context. The script would throw `ReferenceError: require is not defined`.

**Fix:** Replaced `require()` with dynamic `import()` ESM syntax:
```
"dry-run": "tsx -e \"import { runDryRun } from './packages/policy-engine/src/simulator.js'; ...\""
```

---

## 14. No Zod validation on any API route (FIXED)

**Files:** `packages/oracle-server/src/routes/*.ts`

**Root cause:** All API routes accepted raw `req.body` without input validation. Malformed or malicious JSON requests could crash the server with uncaught exceptions (TypeError accessing properties of undefined, NaN values propagating into SQL, etc.). The `compliance.ts` route had manual `if (!agentDid)` checks for only 3 fields, leaving nested objects and types unchecked.

**Fix:** Added Zod schemas for all route inputs:
- `compliance.ts`: `CheckSchema` with nested `proposedAction` object, `amount` type validation, `requestId` string length
- `admin.ts`: `RegisterSchema`, `RevokeSchema`, `SeedPolicySchema`, `ResolveAdminSchema`
- `governance.ts`: `ProposalSchema`, `VoteSchema`, `ResolveSchema`
- All catch blocks now handle `z.ZodError` separately with 400 status and detailed field errors

---

## 15. No graceful shutdown handler for Express server (FIXED)

**File:** `packages/oracle-server/src/index.ts`

**Root cause:** The Express server had no `SIGINT`/`SIGTERM` handler. Killing the process would abruptly close the SQLite database without finalizing WAL transactions, risking database corruption.

**Fix:** Added `gracefulShutdown()` function registered on `SIGINT` and `SIGTERM` that calls `closeDb()` before exiting. Added request logging middleware for observability.

---

## 16. No TypeScript config for oracle-server package (FIXED)

**File:** `packages/oracle-server/tsconfig.json` (created)

**Root cause:** The `packages/oracle-server/` directory had no `tsconfig.json`. The root `tsconfig.json` was used but it excluded `**/*.test.ts` and had no package-specific settings. The CI's `npx tsc --noEmit` would not properly type-check the oracle server's TypeScript files.

**Fix:** Created `packages/oracle-server/tsconfig.json` with ES2022 target, Bundler module resolution, and strict mode enabled.

---

## 17. Diagnostic contract uses same WIT namespace as sentinel contract (FIXED)

**File:** `contracts/diagnostic-contract/wit/world.wit`

**Root cause:** The diagnostic contract's WIT file used `package z:sentinel-compliance@1.0.0` — the same package name as the full sentinel compliance contract. Since the diagnostic contract has a different interface (no host imports, different `generic-input` shape), wit-bindgen would generate incompatible bindings under the same namespace. Building both contracts in the same workspace would cause type conflicts.

**Fix:** Changed to `package z:sentinel-diagnostic@0.1.0` with `world sentinel-diagnostic` and updated the Rust code to import from `z::sentinel_diagnostic::contracts`.
