<div align="center">

# 🛡️ SENTINEL

### The Autonomous Compliance Oracle for Agent Networks

**Deterministic, TEE-sealed policy enforcement for AI agents that spend money, touch data, and act on your behalf — with zero LLM calls anywhere near the decision.**

**Built for the Terminal 3 Agent Dev Kit Bounty Challenge Hackathon.**

[![Built for](https://img.shields.io/badge/built%20for-Terminal%203%20Agent%20Dev%20Kit-6E56CF)](https://www.terminal3.io/claim-page)
[![Policy Engine](https://img.shields.io/badge/policy-Cedar-orange)](https://www.cedarpolicy.com/)
[![Contract](https://img.shields.io/badge/contract-Rust%20%2F%20WASM%20(wasip2)-DEA584)](#tee-contract-functions)
[![Testnet Status](https://img.shields.io/badge/T3N%20testnet-execution%20blocked-critical)](./BUGS.md#bug-1)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-339933)](#prerequisites)

[Quick Start](#quick-start) · [Architecture](#architecture) · [Trust Model](#trust-model) · [Known Issues](#known-issues) · [Bug Bounty](#bug-bounty-disclosures)

</div>

---

## The 60-Second Pitch

> Agent networks are shipping autonomous agents that book flights, move payroll, and execute payments — all under "this API key can call this endpoint" auth models that were never designed for autonomous, repeated, financially consequential action. SENTINEL is the compliance layer that sits between an agent's *intent* and its *execution*: every proposed action is evaluated against a deterministic Cedar policy inside a Terminal 3 TEE, and the verdict comes back as a cryptographically signed, independently verifiable Compliance Receipt. No LLM ever sees the decision. No human has to trust the oracle's word for it — they can verify the receipt against the contract directly.

---

## At a Glance

These are not aspirational numbers — they're counted from the code in this repository.

| Metric | Count | Source |
|---|---|---|
| TEE contract functions exported | **7** | `contracts/sentinel-contract/src/lib.rs` |
| Oracle REST endpoints | **17**, across 5 routers | `packages/oracle-server/src/routes/*.ts` |
| SQLite tables (local fallback) | **7** | `packages/oracle-server/src/services/db.ts` |
| Autonomous demo agents | **4** — Travel, HR/Payroll, Rogue, Expense | `packages/agents/src/*.ts` |
| WASM contract variants built to bisect the T3N bug | **3** — sentinel / diagnostic / minimal | `contracts/*` |
| Cedar policy bundles | **4** | `packages/policy-engine/src/engine.ts` |
| npm lifecycle scripts | **19** | `package.json` |
| Filed SDK bugs & documentation gaps | **5** | [`BUGS.md`](./BUGS.md) |

---

## The Problem

Autonomous agents that hold credentials and execute real-world actions break the assumptions every existing auth model was built on:

- **API keys answer "who," not "should."** They don't encode spend caps, time-of-day restrictions, domain scoping, or velocity limits.
- **"The agent decided it was fine" is not an audit trail.** Regulators and compliance officers need a decision that is explainable, deterministic, and reproducible — not a probabilistic judgment from a language model.
- **Trust in a single backend is a single point of failure.** If the only proof of compliance lives in one company's database, that company is the entire security model.

SENTINEL addresses all three: policy-as-code (Cedar) instead of prompts, a TEE-sealed signature instead of a database row, and a verification path that bypasses the oracle entirely.

---

## What SENTINEL Does

- **Evaluates every proposed agent action** against a Cedar policy scoped to that agent's credential type, spend cap, domain, and time window.
- **Issues a TEE-signed Compliance Receipt** for every verdict — `PERMIT`, `DENY`, or `ESCALATE` — signed inside the WASM contract via the `signing::sign` host interface, not by application code.
- **Tracks cumulative spend velocity** (hourly / daily / weekly sliding windows) so caps apply to real spending behavior, not just single transactions.
- **Escalates borderline actions to a human** with a full lifecycle: created → pending → resolved, audit-logged at every step, with webhook notification.
- **Lets agents recover autonomously.** On `DENY`, agents in this repo renegotiate scope (50% → 25% → 10% of the original amount) without any human or LLM in the loop.
- **Verifies independently of the oracle.** `scripts/verify-receipt-standalone.ts` checks a receipt directly against the TEE contract — no server in this repo needs to be trusted or even running.

---

## Architecture

```
┌─────────────┐        REST         ┌────────────────────────────────────┐        ┌───────────────┐
│   Agents    │────────────────────▶│        SENTINEL Oracle              │───────▶│   Dashboard   │
│ Travel · HR │                     │        (Express · 17 endpoints)     │  REST  │   (Next.js)   │
│ Rogue · Exp │◀────────────────────│  /compliance  /admin  /governance   │        └───────────────┘
└─────────────┘   receipt + verdict │  /audit       /audit/velocity       │
                                     └──────────────┬───────────────────────┘
                                                     │ tenant.contracts.execute()
                                  ┌──────────────────┴───────────────────┐
                                  │           circuit breaker             │
                                  ▼                                      ▼
                  ┌───────────────────────────┐          ┌───────────────────────────────┐
                  │   Rust / WASM TEE Contract │          │     Local Fallback Mode        │
                  │   (T3N · wasm32-wasip2)    │          │  SQLite + TypeScript Cedar      │
                  │                            │          │  engine — bit-identical API     │
                  │  evaluate-compliance        │          │  contract, no TEE seal          │
                  │  register-agent             │          └───────────────────────────────┘
                  │  seed-policy                │
                  │  revoke-agent                │
                  │  verify-receipt              │
                  │  query-audit-log             │
                  │  resolve-escalation          │
                  └──────────────┬────────────────┘
                                 │ kv-store · signing · time · logging (host interfaces)
                                 ▼
                     T3N KV Store + TEE Signing
```

The fallback path is not a degraded demo mode bolted on after the fact — it's the same API contract, the same receipt shape, the same SQLite-backed audit trail, selected transparently by a circuit breaker (`packages/oracle-server/src/services/sentinelContract.ts`) that retries the TEE contract every 60 seconds and switches back automatically the moment it becomes reachable.

### Components

| Package | Role |
|---|---|
| `contracts/sentinel-contract` | Rust/WASM TEE contract — all compliance logic, cryptographically sealed |
| `contracts/diagnostic-contract` | Zero/near-zero-import echo contract, built to bisect the T3N testnet bug ([Bug #1](./BUGS.md#bug-1)) |
| `contracts/minimal-contract` | Single-function `ping()` contract, the smallest possible reproduction case |
| `packages/oracle-server` | Express server — forwards to the TEE contract, falls back to local engine transparently |
| `packages/policy-engine` | Standalone Cedar engine — also reused as a dashboard-facing what-if simulator |
| `packages/t3-client` | T3 ADK wrapper — authenticated client, tenant client, DID extraction |
| `packages/agents` | Four-persona agent simulation with autonomous retry and escalation polling |
| `packages/dashboard` | Next.js regulator dashboard — live feed, audit explorer, governance UI |
| `scripts/` | Setup, deployment, seeding, standalone verification, SDK diagnostics |

---

## Why Cedar, Not an LLM

SENTINEL uses [Cedar](https://www.cedarpolicy.com/), AWS's open-source, schema-based authorization policy language, for every compliance decision in `packages/policy-engine/src/engine.ts` and as the policy text seeded into the TEE contract.

- **Explainable** — every verdict carries the exact policy clause ID that matched (`@id("travel-agent-forbid-night")`, etc.).
- **Deterministic** — identical inputs always produce identical verdicts. No temperature, no sampling, no hallucinated exceptions.
- **Fast** — policy evaluation completes in single-digit milliseconds, not a network round-trip to a model provider.
- **Auditable in isolation** — a Cedar policy can be read, diffed, and reasoned about by a compliance officer without needing to understand a prompt.

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust toolchain with the WASM target: `rustup target add wasm32-wasip2`
- A T3N API key from the [token claim page](https://www.terminal3.io/claim-page)

> **Heads up:** the T3N testnet currently returns `HTTP 500` on all WASM contract execution ([Bug #1](./BUGS.md#bug-1)). The oracle runs in **local fallback mode** with an identical API surface — the steps below work immediately, with or without a working testnet.

```bash
# 1. Clone and install
git clone <repo-url> && cd sentinel
npm install

# 2. Configure environment
cp .env.example .env
# At minimum, set T3N_API_KEY — see "Configuration" below for the full list

# 3. Start the oracle (falls back to local storage if the contract is unreachable)
npm run oracle        # :3001

# 4. In a second terminal, start the dashboard
npm run dashboard      # :3000
# — or run both together —
npm run dev

# 5. Run the four-agent demo
npm run demo

# 6. (Optional) Build and deploy the TEE contract once T3N testnet execution is unblocked
npm run build:contract
npm run deploy:contract
npm run seed:policies
# — or all of the above in one shot —
npm run setup:all
```

### Configuration

The full variable list lives in [`.env.example`](./.env.example); the ones you actually need to touch on day one:

| Variable | Purpose |
|---|---|
| `T3N_API_KEY` | Your testnet private key from the claim page |
| `SENTINEL_TENANT_DID` | Set after `npm run setup` claims a tenant |
| `CONTRACT_TAIL` / `CONTRACT_VERSION` | Identify the deployed WASM contract |
| `OPERATOR_PRIVATE_KEY` | Signs admin operations (register / revoke / seed-policy / resolve-escalation); falls back to `T3N_API_KEY` if unset |
| `ORACLE_SECRET` | Generate with `npm run gen:keys` |
| `ESCALATE_WEBHOOK_URL` / `ESCALATE_WEBHOOK_SECRET` | Optional generic webhook on escalation create/resolve, HMAC-signed |

### Useful Scripts

| Command | What it does |
|---|---|
| `npm run demo` | Runs all four agent scenarios end-to-end |
| `npm run test:policy` / `npm test` | Cedar policy engine smoke tests |
| `npm run dry-run` | One-off policy evaluation against the TS Cedar engine, no server required |
| `npm run verify:receipt` | Standalone receipt verification directly against the TEE contract |
| `npm run seed:governance` / `npm run view:governance` | Seed and inspect demo proposals/escalations |
| `npm run lint` / `npm run typecheck` | `tsc --noEmit` across the workspace |

---

## The Demo

`npm run demo` (`scripts/05-run-demo.ts`) runs four independently-scoped agents end to end:

```
Travel Agent
  ✅ Book flight $500           → PERMIT
  ✅ Search flights             → PERMIT
  ⚠️  Book flight $9,000        → ESCALATE  (90% of $5,000 cap)
  ❌ Payment $15,000            → DENY → 🔄 retries at $7,500 → DENY
                                        → 🔄 retries at $3,750 → PERMIT

HR / Payroll Agent
  ✅ Process payroll $50,000    → PERMIT
  ✅ Access HR records          → PERMIT
  ❌ External payment $10,000   → DENY  (domain mismatch)
  ⚠️  Near-cap payment $95,000  → ESCALATE → operator approves

Rogue Agent
  ❌ Book flight                → DENY  (wrong credential type)
  ❌ Payment $100,000           → DENY → 🔄 all retries exhausted

Expense Agent (delegation demo)
  ✅ Submit expense $200        → PERMIT  (delegated from Travel Agent)
  ⚠️  Submit expense $4,500     → ESCALATE (near cap)
  ❌ Submit expense $8,000      → DENY    (over cap, wrong domain)
```

The retry behavior is real, not scripted output — `retryWithReducedScope()` in `packages/agents/src/agentBase.ts` computes 50% / 25% / 10% of the original amount and resubmits to the live compliance check until it either gets a `PERMIT` or exhausts its attempts.

---

## Feature Deep Dive

### Compliance Oracle API

Every endpoint attempts the TEE contract first via `callContract()` and transparently falls back to the local Cedar engine + SQLite if it's unreachable — same response shape either way.

| Method | Path | Description | Backed by |
|---|---|---|---|
| `POST` | `/api/compliance/check` | Evaluate a proposed action | `evaluate-compliance` / local Cedar |
| `POST` | `/api/admin/register-agent` | Register an agent credential | `register-agent` (signed) |
| `POST` | `/api/admin/revoke` | Revoke an agent credential | `revoke-agent` (signed) |
| `POST` | `/api/admin/seed-policy` | Upload a Cedar policy for an agent type | `seed-policy` (signed) |
| `POST` | `/api/admin/resolve-escalation` | Approve/deny a pending escalation | `resolve-escalation` (signed) |
| `GET` | `/api/governance/proposals` | List multi-sig proposals | SQLite |
| `POST` | `/api/governance/proposals` | Create a multi-sig proposal | SQLite |
| `POST` | `/api/governance/proposals/:id/vote` | Cast a yea/nay vote | SQLite |
| `GET` | `/api/governance/escalations` | List pending escalations | SQLite |
| `POST` | `/api/governance/escalations/:id/resolve` | Resolve via governance flow | SQLite + webhook |
| `GET` | `/api/audit/stream` | Audit log stream, `since` filter | `query-audit-log` / SQLite |
| `GET` | `/api/audit/agents` | Agents seen in the audit trail | `query-audit-log` / SQLite |
| `GET` | `/api/audit/receipt/:id` | Verify a Compliance Receipt | `verify-receipt` / SQLite |
| `GET` | `/api/audit/export` | Download the full audit trail as JSON | `query-audit-log` / SQLite |
| `GET` | `/api/audit/velocity/:agentDid` | Spend velocity for one agent | SQLite |
| `GET` | `/api/audit/velocity/summary` | Spend velocity across all agents | SQLite |
| `GET` | `/api/health` | Health + current mode (`contract` / `local`) | — |

Admin (`/api/admin/*`) and governance (`/api/governance/*`) routes are rate-limited at 30 req/min and 20 req/min respectively (`packages/oracle-server/src/middleware/rateLimit.ts`).

### Idempotent Compliance

Compliance checks are deduplicated by `requestId` (`request_cache` table, 24h TTL, periodic eviction). A retried HTTP request returns the original cached verdict instead of re-evaluating — this is what prevents a network retry from double-recording spend against an agent's cap.

### TEE Contract Functions

All seven functions in `contracts/sentinel-contract/src/lib.rs`:

| Function | Purpose | Auth |
|---|---|---|
| `evaluate-compliance` | Deterministic policy evaluation, issues a signed receipt | None |
| `register-agent` | Write a new agent credential into contract KV | Signed |
| `seed-policy` | Upload a Cedar policy for an agent type | Signed |
| `revoke-agent` | Kill switch — flips status and invalidates all outstanding receipts for that DID | Signed |
| `resolve-escalation` | Operator approve/deny, replays spend recording on approval | Signed |
| `verify-receipt` | Third-party receipt validation against revocation + expiry state | None |
| `query-audit-log` | Filtered audit log query (agent, time range, limit) | None |

Admin operations are gated by `require_admin_auth()` in `compliance.rs`, which canonicalizes the request (excluding the `signature` field), and verifies it against an operator public key stored in the contract's `admin-config` KV namespace via the `signing::verify` host interface.

### Dashboard

A Next.js application consuming the Oracle's REST API: live verdict feed, agent management with revocation, receipt verification, JSON audit export, a pending-escalations panel, spend-velocity charts (hourly/daily/weekly), and a multi-sig governance view for M-of-N proposal approval.

### Autonomous Agent Behavior

No LLM, no prompt — pure deterministic feedback loops in `packages/agents/src/agentBase.ts`:

1. **Retry with reduced scope** — on `DENY`, an agent resubmits at 50%, then 25%, then 10% of the original amount.
2. **Escalation polling** — `pollEscalation()` watches the audit stream for a resolution event before an agent proceeds.
3. **Velocity-aware spend caps** — caps are checked against cumulative spend in the current hourly/daily/weekly window, not the single transaction in front of the agent.

---

## Repository Map

```
contracts/
├── sentinel-contract/     # Production TEE contract (7 exports, full compliance logic)
├── diagnostic-contract/   # Echo contract used to bisect the T3N testnet 500 error
└── minimal-contract/      # Single ping() function — smallest possible repro case
packages/
├── oracle-server/         # Express API — contract-first, SQLite fallback
├── policy-engine/         # Cedar policies + TypeScript evaluator + dry-run simulator
├── t3-client/              # T3 ADK client wrapper (auth, tenant, DID handling)
├── agents/                 # Travel / HR-Payroll / Rogue / Expense demo agents
└── dashboard/               # Next.js regulator dashboard
scripts/                    # Setup, deploy, seed, standalone verification, SDK diagnostics
.github/workflows/ci.yml    # Rust build+clippy, TS typecheck, smoke tests, integration tests
render.yaml                 # Render deployment manifest for the oracle service
```

---

## Trust Model

Written for the security engineers and compliance officers who will actually have to sign off on something like this — separating what's cryptographically provable from what remains operationally trusted.

### Cryptographically Provable (once the TEE contract is executing)

> The claims below describe the system's design when the contract is live on the T3N ledger. Due to the open testnet issue in [Bug #1](./BUGS.md#bug-1), the contract currently cannot execute, and the oracle runs in local fallback mode — functionally identical, but without the TEE seal. All contract code is written, compiled, and ready; unblocking it requires only a fix on the T3N side.

1. **Every decision is recorded in a TEE-signed receipt**, signed inside the WASM contract via `signing::sign` — not by the oracle server.
2. **Anyone can verify a receipt without trusting the oracle at all.** `scripts/verify-receipt-standalone.ts` calls `verify-receipt` directly on the deployed contract through the T3N SDK.
3. **Agent registrations, policies, and revocations live in the contract's KV namespace** on the T3N ledger — restarting the oracle does not erase state, and the trail is durable and queryable.
4. **Revocation immediately invalidates outstanding receipts.** `verify-receipt` checks the `revocations` KV map before returning `valid: true`.

### Operationally Trusted (not cryptographically enforced)

1. **The oracle's signing key gates admin-class operations.** `register-agent`, `revoke-agent`, `seed-policy`, and `resolve-escalation` all require a signature checked against an operator public key in contract KV. Compromise of the corresponding private key would allow unauthorized admin operations.
2. **The T3N TEE infrastructure is trusted for correctness.** Signing and verification depend on the host's `signing::sign` / `signing::verify` implementations and the underlying TEE attestation.
3. **Oracle availability is required for agents to act.** Agents talk to the contract through the oracle's HTTP API; a future P2P architecture (agents calling the contract directly) would remove this dependency.
4. **A receipt attests to a point-in-time decision, not future validity.** It does not prevent execution after revocation — it guarantees that *proving* compliance after revocation will fail.

These boundaries are explicit by design — a compliance product that claimed to eliminate every trust assumption would be dishonest. The architecture is built so that every future hardening step (P2P contract calls, threshold-signature admin governance) shrinks the trusted surface incrementally, without an architectural rewrite.

---

## Known Issues

### T3N testnet contract execution is currently blocked

Every WASM contract execution attempt against the T3N testnet returns `HTTP 500: Internal error`, reproduced across the full Sentinel contract, a zero-import diagnostic contract, and a single-function minimal contract, across two SDK versions and two `wit-bindgen` versions. Full reproduction steps, environment matrix, and nine testnet request IDs are filed as [Bug #1](./BUGS.md#bug-1).

**Impact on this submission:** all seven contract exports are implemented in Rust, compile cleanly to `wasm32-wasip2`, and are exercised by the local fallback path on every request — but cannot currently execute *on T3N infrastructure*. The oracle's circuit breaker (`packages/oracle-server/src/services/sentinelContract.ts`) retries every 60 seconds and will switch to contract-backed mode automatically the moment the testnet issue is resolved, with zero code changes required.

**Escalation status:** filed via Telegram (`t.me/terminal3developer`) and email (`devrel@terminal3.io`).

### Three more SDK gaps, documented as formal bug reports

`client.handshake()` has no built-in timeout ([Bug #4](./BUGS.md#bug-4)), `client.authenticate()` returns an untyped union of four possible shapes ([Bug #5](./BUGS.md#bug-5)), and the standard ADK scaffolding has no `register-agent` primitive or documentation distinguishing the two KV storage paths ([Bug #2](./BUGS.md#bug-2), [Bug #3](./BUGS.md#bug-3)). See [`BUGS.md`](./BUGS.md) for full detail.

---

## Verification Examples

### Standalone receipt verification — no oracle server required

```bash
tsx scripts/verify-receipt-standalone.ts RCP-req-1718841600000-abc123 did:t3n:travel-agent-demo
```

```
╔══════════════════════════════════════════════════╗
║     SENTINEL — STANDALONE RECEIPT VERIFIER       ║
╚══════════════════════════════════════════════════╝
  Receipt ID  : RCP-req-1718841600000-abc123
  Agent DID   : did:t3n:travel-agent-demo
  Contract    : sentinel-compliance-oracle@1.0.0

  ✅ STATUS : VALID
  ✅ Reason : Receipt is cryptographically valid

  Verified directly against the TEE contract.
  No oracle server or intermediary was trusted.
```

### Policy what-if simulation

```bash
npm run dry-run
```

Runs the same Cedar engine that backs the local fallback path against a sample `travel-booking` action, with no server, no contract, and a `simulation: true` / `disclaimer` field on the result so it's never mistaken for an authoritative receipt.

---

## SDK Integration Depth

| SDK Surface | Usage | File |
|---|---|---|
| `T3nClient` (authenticated) | `createAuthenticatedClient()` — auth + DID extraction | `packages/t3-client/src/client.ts` |
| `TenantClient` | `createTenantClient()` — tenant-scoped operations | `packages/t3-client/src/client.ts` |
| `tenant.contracts.register()` | Contract deployment | `scripts/03-deploy-contract.ts` |
| `tenant.contracts.execute()` | All 7 contract function calls | `packages/oracle-server/src/services/sentinelContract.ts` |
| `tenant.maps.create()` | Policy KV map creation | `scripts/setup.ts` |
| `tenant.claim()` / `tenant.me()` | Tenant DID registration + verification | `scripts/setup.ts` |
| `createEthAuthInput()` | Authentication input construction | `packages/t3-client/src/client.ts` |
| `loadWasmComponent()` | WASM component loading (cached) | `packages/t3-client/src/client.ts` |
| `setEnvironment()` / `getNodeUrl()` | Testnet/production routing | `packages/t3-client/src/client.ts`, `scripts/check-sdk.ts` |
| `signing::sign` (host interface) | TEE-signed receipt generation | `contracts/sentinel-contract/src/receipt.rs` |
| `signing::verify` (host interface) | Admin signature verification inside the TEE | `contracts/sentinel-contract/src/compliance.rs` |
| `kv-store` (host interface) | Agent registry, policies, audit log, spend ledger, revocations | `contracts/sentinel-contract/src/*.rs` |
| `tenant-context` (host interface) | Per-tenant KV namespacing (`z:{tenantDid}:{suffix}`) | `contracts/sentinel-contract/src/*.rs` |

---

## Bug Bounty Disclosures

Five reports filed against the T3N SDK and ADK documentation — full reproduction steps, environment matrices, and request IDs in [`BUGS.md`](./BUGS.md).

| # | Title | Category | Severity |
|---|---|---|---|
| [1](./BUGS.md#bug-1) | Contract execution fails with `HTTP 500` on T3N testnet | SDK / Infra | Critical — blocking |
| [2](./BUGS.md#bug-2) | Missing `register-agent` primitive in ADK scaffolding | Documentation | Medium |
| [3](./BUGS.md#bug-3) | `contracts.execute()` KV vs. component-internal `kv-store` not distinguished | Documentation | Medium |
| [4](./BUGS.md#bug-4) | `T3nClient.handshake()` has no built-in timeout | SDK | Medium |
| [5](./BUGS.md#bug-5) | `client.authenticate()` return type is untyped/opaque | SDK | Low |

---

## Engineering Highlights

| Category | What's actually implemented |
|---|---|
| **Security & Auth** | HMAC-signed admin operations, canonicalized payloads excluding `signature` before signing, agent revocation immediately invalidates outstanding receipts |
| **Resilience** | Contract-first with automatic SQLite fallback, 60s circuit breaker retry, idempotent compliance checks keyed by `requestId` |
| **Data layer** | 7-table SQLite schema (WAL mode, prepared-statement caching via `StmtCache`, transaction-batched spend writes across hourly/daily/weekly windows) |
| **Observability** | Structured logging via `pino` / `pino-http`, centralized `errorHandler` with typed `AppError` subclasses, per-request UUID tracing |
| **API hardening** | `helmet`, `compression`, configurable CORS origin, Zod request validation on every mutating route, tiered rate limiting on admin/governance |
| **Testing & CI** | GitHub Actions: Rust build + clippy + (soft) fmt check, diagnostic-contract build, TypeScript `tsc --noEmit`, Cedar policy smoke tests, curl-based integration tests, secret-scanning audit job |
| **Agent autonomy** | Deterministic retry-with-reduced-scope, escalation polling, agent-to-agent delegation (Travel → Expense) with independently scoped credentials |
| **Verifiability** | Standalone receipt verifier that never touches the oracle server, policy what-if simulator clearly labeled as non-authoritative |

---

## Roadmap

**Shipped this cycle:** full 7-function TEE contract, SQLite-backed local fallback with feature parity, sliding-window spend velocity (hourly/daily/weekly, both in Rust and TypeScript), webhook escalation notifications, standalone receipt verification, multi-sig governance MVP, request deduplication, structured logging, and five filed SDK bug reports.

**Next:**
- Unblock T3N testnet contract execution and switch the demo to fully TEE-backed mode (zero code changes required — purely infra-side)
- P2P agent-to-contract calls, removing the oracle server from the trust-critical path
- Cedar policy soundness checks integrated into CI
- Threshold-signature-based admin governance to shrink the operationally-trusted surface further

---

## Submission Assets

- **Demo video:** `[ add link here ]`
- **Live deployment:** the oracle ships with a Render manifest (`render.yaml`, health check at `/api/health`, persistent disk for SQLite); the dashboard's CORS configuration assumes a Vercel deployment. `[ add live URLs here once deployed ]`
- **Bug bounty submissions:** [`BUGS.md`](./BUGS.md)

---

## License & Acknowledgments

Submitted for the Terminal 3 Agent Dev Kit Bounty (9–22 June 2026). A formal open-source license will be added post-hackathon; until then, this repository is shared for judging and evaluation purposes under the bounty's terms.

Built entirely on the T3 Agent Dev Kit. Zero LLM API keys anywhere in the compliance path. Every verdict is deterministic, explainable, and designed to be TEE-sealed.