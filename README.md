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
┌──────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Agents     │────▶│  Sentinel Oracle │────▶│  Dashboard  │
│ (Travel, HR, │     │  (Express + TEE) │     │  (Next.js)  │
│  Rogue)      │     │                  │     │             │
└──────────────┘     ├──────────────────┤     └─────────────┘
                     │  Policy Engine   │
                     │  (Cedar WASM)    │     ┌─────────────┐
                     ├──────────────────┤     │  T3N Ledger │
                     │  TEE Contract    │────▶│  (KV Store) │
                     │  (Rust/WASM)     │     └─────────────┘
                     └──────────────────┘
```

### Components

| Package | Role |
|---------|------|
| `packages/policy-engine` | Cedar policy evaluator — deterministic, zero-cost compliance checks |
| `packages/t3-client` | T3 ADK wrapper — authenticated client, DID management |
| `packages/oracle-server` | Express compliance oracle — verdict, audit, admin APIs |
| `packages/agents` | Multi-agent simulation — travel, HR, rogue demo agents |
| `packages/dashboard` | Next.js regulator dashboard — live SSE feed, audit explorer |
| `contracts/sentinel-contract` | Rust/WASM TEE contract — cryptographically sealed verdicts |

### Policy Language: Cedar

SENTINEL uses [Cedar](https://www.cedarpolicy.com/) as its policy language — a deterministic, schema-based authorization policy language developed at AWS. Unlike general-purpose "rule engines" or LLM-based approaches:

- **Every decision is explainable** — Cedar outputs the exact policy clause that matched
- **Every decision is deterministic** — same inputs always produce the same verdict
- **No LLM latency or hallucination** — decisions complete in ~5ms
- **Formally verifiable** — Cedar policies can be audited and proven correct

Example policy (`travel-agent.cedar`):
```
permit(
  principal is SentinelAgent,
  action in [SentinelAction::"book-flight", SentinelAction::"book-hotel"],
  resource is SentinelResource
) when {
  principal.agentType == "travel-booking" &&
  resource.amount <= 5000 &&
  resource.domain in ["flights", "hotels", "trains"]
};
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- Rust toolchain (for TEE contract): `rustup target add wasm32-wasip2`
- T3N API key from [terminal3.io/claim-page](https://terminal3.io/claim-page)

### Setup (5 steps)

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

The demo runs three agent scenarios:

```
╔══════════════════════════════════════════╗
║     SENTINEL COMPLIANCE ORACLE DEMO      ║
╚══════════════════════════════════════════╝

Act 1 — Travel Agent (within policy)
  → PERMIT — Compliance Receipt issued

Act 2 — HR Payroll Agent (spend cap breach)
  → ESCALATE — flagged for human review

Act 3 — Rogue Agent (after hours, domain mismatch)
  → DENY — action blocked, audit trail recorded
```

---

## Features

### Compliance Oracle API

- `POST /api/verdict` — Evaluate an agent action against policy
- `POST /api/admin/revoke` — Revoke an agent credential
- `POST /api/admin/register-agent` — Register a new agent
- `GET /api/audit/stream` — SSE audit log stream
- `GET /api/audit/export` — Download audit log as JSON
- `GET /api/audit/receipt/:id` — Verify a Compliance Receipt

### Dashboard

- Real-time live feed of compliance verdicts via SSE
- Agent management with credential status and revocation
- Policy clause display for every decision
- Compliance Receipt verification with signature display
- JSON export of the full audit trail

### TEE Contract Functions

- `evaluate-compliance` — Deterministic policy evaluation inside TEE
- `revoke-agent` — Operator kill switch with audit trace
- `verify-receipt` — Third-party receipt validation
- `query-audit-log` — Filtered audit log queries

---

## Design Partner Pitch

*For enterprise customers evaluating T3N for regulated agent deployments:*

SENTINEL provides the compliance infrastructure that makes agent networks auditable by regulators. Every agent action produces a cryptographic Compliance Receipt — a TEE-sealed record of the policy evaluation, signed by the oracle's enclave key and stored on the T3N ledger. This gives compliance officers and regulators:

1. **Real-time visibility** into every agent action across the network
2. **Deterministic enforcement** — no LLM black box, every decision has an explainable policy clause
3. **Cryptographic proof** — Compliance Receipts are verifiable by third parties without access to the oracle
4. **Kill switch** — operator-initiated credential revocation with full audit trail

SENTINEL turns the T3N audit ledger from a record of what happened into a real-time, cryptographically enforced proof that every agent on your network is operating within policy.

---

## Submission Checklist

- [x] `T3nClient` authenticated with real T3N testnet
- [x] Tenant DID registered
- [x] 3 demo agents with distinct credential types
- [x] TEE WASM contract compiled for wasm32-wasip2
- [x] KV store for agent registry, policies, audit log, receipts
- [x] `revoke-agent` endpoint with audit trace
- [x] `verify-receipt` endpoint
- [x] `query-audit-log` endpoint (SSE stream + export)
- [x] All 3 demo acts run without error
- [x] Dashboard shows live updates in real time
- [x] Revoke button works and reflects immediately
- [x] Compliance Receipt verifiable via dashboard
- [x] Export (JSON) works with all audit entries
- [ ] Demo video recorded

---

## Bug Bounty

Bug reports filed during development:
- [List your filed bug reports here with links]

---

Built for the Terminal 3 Hackathon (June 9–22, 2026).
