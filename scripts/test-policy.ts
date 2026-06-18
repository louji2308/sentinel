import { evaluatePolicy } from "../packages/policy-engine/src/engine.js";

const basePrincipal = {
  did: "did:t3n:travel-agent-demo",
  credentialStatus: "active" as const,
  credentialType: "travel-booking",
  spendCap: 10000,
  credentialExpiresAt: 9999999999,
};

const tests = [
  {
    label: "work hours permit",
    action: "book_flight",
    resource: { type: "TravelSystem", domain: "travel", amount: 500 },
    context: { hourOfDay: 10, dayOfWeek: "Thu", currentTimestamp: 9999999999, requestId: "t1" },
    principal: basePrincipal,
  },
  {
    label: "night forbid",
    action: "book_flight",
    resource: { type: "TravelSystem", domain: "travel", amount: 500 },
    context: { hourOfDay: 20, dayOfWeek: "Thu", currentTimestamp: 9999999999, requestId: "t2" },
    principal: basePrincipal,
  },
  {
    label: "escalate near cap",
    action: "book_flight",
    resource: { type: "TravelSystem", domain: "travel", amount: 9000 },
    context: { hourOfDay: 10, dayOfWeek: "Thu", currentTimestamp: 9999999999, requestId: "t3" },
    principal: basePrincipal,
  },
  {
    label: "rogue deny",
    action: "book_flight",
    resource: { type: "TravelSystem", domain: "travel", amount: 500 },
    context: { hourOfDay: 10, dayOfWeek: "Thu", currentTimestamp: 9999999999, requestId: "t4" },
    principal: { did: "did:t3n:rogue", credentialStatus: "active" as const, credentialType: "unverified", spendCap: 100, credentialExpiresAt: 9999999999 },
  },
  {
    label: "revoked deny",
    action: "book_flight",
    resource: { type: "TravelSystem", domain: "travel", amount: 500 },
    context: { hourOfDay: 10, dayOfWeek: "Thu", currentTimestamp: 9999999999, requestId: "t5" },
    principal: { ...basePrincipal, credentialStatus: "revoked" as const },
  },
];

for (const t of tests) {
  const result = await evaluatePolicy(t.principal, t.action, t.resource, t.context);
  console.log(`${t.label}: ${result.decision} (${result.matchedPolicyId}) — ${result.reason.substring(0, 80)}`);
}
