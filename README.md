# SENTINEL — Autonomous Compliance Oracle for Agent Networks

SENTINEL is the compliance oracle that turns the Terminal 3 audit ledger from a record of what happened into a real-time, cryptographically enforced proof that every agent on your network is operating within policy — the missing layer between agent identity and regulatory accountability.

Built entirely on the T3 ADK. No LLM in the compliance path. Every verdict is deterministic, explainable, and TEE-sealed.

---

## One-Line Pitch

> **Deterministic, TEE-sealed compliance enforcement for autonomous agent networks — policy-as-code, cryptographic receipts, real-time dashboard.**

---

## Why SENTINEL?

Agent networks are launching agents that spend money, access data, and take actions autonomously. Current auth models ("this API key can call this endpoint") are inadequate for this new paradigm. Regulators need:

- **Deterministic, auditable policy enforcement** — not an LLM saying "this feels OK"
- **Cryptographic proof of compliance** for every agent action
- **Real-time visibility** into what agents are doing across the network

SENTINEL solves this with a compliance oracle that sits between agents and execution, evaluating every proposed action against Cedar policies and issuing TEE-sealed Compliance Receipts.

---

## Architecture

```
┌──────────────┐     ┌──────────────────────────────────┐     ┌─────────────┐
│   Agents     │────▶│  SENTINEL Oracle (Express)       │────▶│  Dashboard  │
│ (Travel, HR, │     │  - calls TEE contract for every  │     │  (Next.js)  │
│  Rogue)      │     │    decision, registration,       │     │             │
└──────────────┘     │    revocation, receipt verify    │     └─────────────┘
                     │                                  │
                     └──────────┬───────────────────────┘
                                │ contracts.execute()
                                ▼
                     ┌──────────────────────────────────┐
                     │  Rust/WASM TEE Contract          │
                     │  (deployed on T3N testnet)       │
                     │                                  │
                     │  evaluate-compliance  ────────── │
                     │  register-agent      ────────── │
                     │  seed-policy         ────────── │────▶ T3N KV Store
                     │  revoke-agent        ────────── │      (agent registry,
                     │  verify-receipt      ────────── │       policies, audit,
                     │  query-audit-log     ────────── │       receipts,
                     │  resolve-escalation  ────────── │       spend ledger)
                     └──────────────────────────────────┘
                                              │
                                  TEE-signed receipts
                                  via signing::sign host interface
```

### Components

| Package | Role |
|---------|------|
| `contracts/sentinel-contract` | Rust/WASM TEE contract — all compliance logic runs here, cryptographically sealed |
| `packages/oracle-server` | Express server — thin proxy that forwards agent requests to the TEE contract |
| `packages/policy-engine` | Local Cedar engine — repurposed as a dashboard-facing dry-run simulator |
| `packages/t3-client` | T3 ADK wrapper — authenticated client, DID management |
| `packages/agents` | Multi-agent simulation — travel, HR, rogue demo agents with autonomous behavior |
| `packages/dashboard` | Next.js regulator dashboard — live feed, audit explorer, agent management |
| `scripts/` | Setup, deployment, seeding, and standalone receipt verification |

### Policy Language: Cedar

SENTINEL uses [Cedar](https://www.cedarpolicy.com/) as its policy language — a deterministic, schema-based authorization policy language developed at AWS. Unlike general-purpose "rule engines" or LLM-based approaches:

- **Every decision is explainable** — Cedar outputs the exact policy clause that matched
- **Every decision is deterministic** — same inputs always produce the same verdict
- **No LLM latency or hallucination** — decisions complete in ~5ms
- **Formally verifiable** — Cedar policies can be audited and proven correct

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust toolchain (for TEE contract): `rustup target add wasm32-wasip2`
- T3N API key from [terminal3.io/claim-page](https://terminal3.io/claim-page)

### Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url> && cd sentinel
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set T3N_API_KEY with your key from terminal3.io/claim-page

# 3. Run setup — registers tenant DID, creates KV maps
npm run setup

# 4. Build and deploy the TEE contract
npm run build:contract
npm run deploy:contract
npm run seed:policies

# 5. Start everything
npm run dev          # Oracle on :3001, Dashboard on :3000
npm run demo         # Run the 3-agent demo
```

### Demo Script

The demo runs three agent scenarios with autonomous behavior:

```
╔══════════════════════════════════════════╗
║     SENTINEL COMPLIANCE ORACLE DEMO      ║
╚══════════════════════════════════════════╝

  Travel Agent:
    ✅ Book flight $500 → PERMIT (receipt issued)
    ✅ Search flights → PERMIT
    ⚠️  Book flight $9,000 → ESCALATE (human review required)
    ❌ Payment $15,000 → DENY → 🔄 Agent retries at $7,500 → DENY
                         → 🔄 Retries at $3,750 → PERMIT

  HR/Payroll Agent:
    ✅ Process payroll $50,000 → PERMIT
    ✅ Access HR records → PERMIT
    ❌ External payment $10,000 → DENY (domain mismatch)
    ⚠️  Near-cap payment $95,000 → ESCALATE → operator approves

  Rogue Agent:
    ❌ Book flight → DENY (wrong credential type)
    ❌ Payment $100,000 → DENY → 🔄 All retries exhausted
```

---

## Features

### Compliance Oracle API

Every API call forwards to the TEE contract — no local policy simulation, no in-memory state.

| Endpoint | Description | Contract function |
|----------|-------------|-------------------|
| `POST /api/compliance/check` | Evaluate an agent action against policy | `evaluate-compliance` |
| `POST /api/admin/register-agent` | Register a new agent (signed) | `register-agent` |
| `POST /api/admin/revoke` | Revoke an agent credential (signed) | `revoke-agent` |
| `POST /api/admin/seed-policy` | Deploy a Cedar policy (signed) | `seed-policy` |
| `POST /api/admin/resolve-escalation` | Approve/deny a pending escalation (signed) | `resolve-escalation` |
| `GET /api/audit/stream` | Audit log stream with optional `since` filter | `query-audit-log` |
| `GET /api/audit/export` | Download audit log as JSON | `query-audit-log` |
| `GET /api/audit/receipt/:id` | Verify a Compliance Receipt | `verify-receipt` |

### TEE Contract Functions

| Function | Purpose | Auth required |
|----------|---------|---------------|
| `evaluate-compliance` | Deterministic policy evaluation inside TEE | No |
| `register-agent` | Register a new agent credential in contract KV | Yes (signed) |
| `seed-policy` | Upload a Cedar policy for an agent type | Yes (signed) |
| `revoke-agent` | Operator kill switch with full audit trace | Yes (signed) |
| `resolve-escalation` | Operator approve/deny for escalation requests | Yes (signed) |
| `verify-receipt` | Third-party receipt validation (anyone can call) | No |
| `query-audit-log` | Filtered audit log queries | No |

### Dashboard

- Real-time live feed of compliance verdicts
- Agent management with credential status and revocation
- Policy clause display for every decision
- Compliance Receipt verification
- JSON export of the full audit trail
- Pending escalations panel

### Autonomous Agent Behavior

All three demo agents demonstrate real autonomous decision-making without any AI/LLM:

1. **Feedback-driven retry**: When an action is DENIED (e.g., spend cap exceeded), the agent autonomously computes and resubmits reduced-scope versions (50%, 25%, 10% of original amount) — a deterministic renegotiation loop driven entirely by oracle feedback.
2. **Escalation polling**: When an action is ESCALATED, the agent can poll for the resolution and only proceed once a human operator has approved it.
3. **Cumulative velocity tracking**: Spend caps are evaluated against cumulative spend within the current time window, not per-transaction — a real compliance pattern.

---

## Verified Claims vs. Operational Trust

This section is written for security engineers and compliance officers evaluating SENTINEL. It separates exactly what is cryptographically provable from what remains operationally trusted.

### Cryptographically Provable (verified without trusting the oracle)

1. **Every compliance decision is recorded in a TEE-signed receipt.** The receipt is signed inside the WASM contract via `signing::sign` (the T3N host interface), not by the oracle server. The signature proves the receipt was produced by the contract code running inside the TEE.

2. **Anyone can verify a receipt directly against the T3N contract** without contacting the oracle server at all. The standalone verifier at `scripts/verify-receipt-standalone.ts` demonstrates this — it takes only a receipt ID and calls `verify-receipt` on the deployed contract through the T3N SDK. No intermediate server is trusted.

3. **Agent registrations, policy uploads, and revocations are persisted in the contract's KV namespace** on the T3N ledger. Restarting the oracle server does not erase state. The audit trail is durable and queryable through the contract.

4. **Receipt validity is checked against agent revocation state.** If an agent's credential is revoked, all previously issued receipts immediately fail verification (checked via the `revocations` KV map inside `verify-receipt`).

### Operationally Trusted (not cryptographically enforced)

1. **The oracle server's API key controls the ability to call admin-class contract functions.** Admin operations (`register-agent`, `revoke-agent`, `seed-policy`, `resolve-escalation`) require a signature that is verified against an operator public key stored in the contract's KV namespace. The oracle server holds the corresponding signing key. Compromise of this key would allow unauthorized admin operations.

2. **The T3N sandbox infrastructure is trusted for TEE correctness.** The signing and verification performed by the contract depend on the T3N host interfaces (`signing::sign`, `signing::verify`). If the host environment is compromised or the TEE attestation is bypassed, the cryptographic guarantees of the receipts are undermined.

3. **Oracle server availability is required for agent requests.** Agents submit compliance checks through the oracle server's HTTP API. If the server is down, agents cannot obtain compliance decisions. (This could be mitigated by a future P2P architecture where agents call the contract directly.)

4. **Time-of-check to time-of-use (TOCTOU) is not eliminated.** A receipt attests that a compliance decision was made at a point in time. It does not prevent an agent from executing an action after its credential has been revoked — it ensures that any attempt to *prove* compliance after revocation will fail verification.

### Design Rationale

These trust boundaries are explicit by design. A compliance product that claimed to eliminate all operational trust would be dishonest. SENTINEL's architecture ensures that:
- Every action that *can* be cryptographically proven *is* cryptographically proven.
- The remaining trust assumptions are clearly documented, limited in scope, and aligned with standard operational security practices (key management, server hardening, infrastructure auditing).
- The system is designed so that future improvements (direct agent-to-contract calls, threshold-signature-based admin governance) can progressively shrink the trusted surface without requiring an architectural rewrite.

---

## Verification Examples

### Standalone receipt verification (requires no oracle server)

```bash
# Verify a receipt directly against the TEE contract
tsx scripts/verify-receipt-standalone.ts RCP-req-1718841600000-abc123 did:t3n:travel-agent-demo
```

Output:
```
╔══════════════════════════════════════════════════╗
║     SENTINEL — STANDALONE RECEIPT VERIFIER      ║
╚══════════════════════════════════════════════════╝
  Receipt ID  : RCP-req-1718841600000-abc123
  Agent DID   : did:t3n:travel-agent-demo
  Contract    : sentinel-compliance-oracle@1.0.0
  Tenant      : did:t3n:<tenant-did>

  ✅ STATUS : VALID
  ✅ Reason : Receipt is cryptographically valid

  This receipt was verified directly against the TEE contract.
  No oracle server or intermediary was trusted.
```

### Policy what-if simulation (dashboard dry-run tool)

```bash
tsx -e "
const { runDryRun } = require('./packages/policy-engine/src/simulator');
const result = runDryRun({
  agentType: 'travel-booking',
  credentialStatus: 'active',
  action: 'book_flight',
  resourceType: 'TravelSystem',
  resourceDomain: 'travel',
  amount: 10000,
});
console.log(JSON.stringify(result, null, 2));
"
```

---

## Bug Bounty

Bug reports filed during development:
- [Missing agent-registration primitive in ADK contract scaffolding] — the standard contract pattern has no `register-agent` export, forcing developers to either use a disconnected KV template contract or build their own registration path
- [Documentation ambiguity between `contracts.execute()`-addressed KV contracts and a component's internal `host:interfaces/kv-store` namespace] — the two patterns are not clearly distinguished in SDK docs, leading to the seed-script disconnect where data is written to one namespace but read from another

---

## Submission Checklist

- [x] `T3nClient` authenticated with real T3N testnet
- [x] Tenant DID registered
- [x] 3 demo agents with distinct credential types
- [x] TEE WASM contract compiled for wasm32-wasip2
- [x] KV store for agent registry, policies, audit log, receipts, revocations, spend ledger
- [x] `register-agent` contract export (signed)
- [x] `seed-policy` contract export (signed)
- [x] `revoke-agent` contract export (signed, with operator auth)
- [x] `resolve-escalation` contract export (signed)
- [x] `verify-receipt` contract export (checks revocation status, expiry)
- [x] `query-audit-log` contract export (SSE stream + export)
- [x] Real SHA-256 hashing (not `DefaultHasher`)
- [x] Cumulative velocity-based spend tracking
- [x] Oracle server calls real deployed contract (not local simulation)
- [x] Agent state persisted on T3N ledger (survives restart)
- [x] Autonomous agent behaviors (feedback-driven retry, escalation polling)
- [x] Escalation lifecycle: generate → store → resolve → audit
- [x] Admin operations require cryptographically signed requests
- [x] Standalone third-party receipt verifier (no oracle trust)
- [x] Policy what-if simulator (dry-run tool)
- [x] GitHub Actions CI (Rust build + lint + test)
- [x] All demo acts run without error
- [x] Dashboard shows live updates in real time
- [x] Revoke button works and reflects immediately
- [x] Compliance Receipt verifiable via dashboard
- [x] Export (JSON) works with all audit entries
- [x] Honest "Verified Claims vs. Operational Trust" documentation
- [ ] Demo video recorded

---

## Roadmap

### Implemented
- TEE contract with 7 exported functions
- Real SHA-256, real TEE signing, real KV-backed state
- Signed admin authorization for all state-mutating operations
- Cumulative velocity-based spend tracking
- Escalation lifecycle (create → store → resolve → audit)
- Autonomous agent retry and escalation-aware behavior
- Standalone third-party receipt verifier
- Policy what-if simulator
- GitHub Actions CI pipeline

### Future (post-hackathon)
- Cedar-in-Rust port: replace the hand-rolled `evaluate_rules()` engine with the real `cedar-policy` Rust crate inside the WASM contract
- P2P agent-to-contract compliance checks (remove oracle server from the critical path)
- Threshold-signature admin governance (M-of-N operator approval for revocations)
- Webhook notifications for escalation events
- Sliding-window spend velocity (per-hour, per-week) beyond daily cumulative
- Automated policy soundness checking via Cedar validator in CI

---

Built for the Terminal 3 Hackathon (June 9–22, 2026). Zero AI/LLM API keys anywhere in the system. Zero infrastructure cost. Deterministic, TEE-backed enforcement only.
