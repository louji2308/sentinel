import * as cedar from "@cedar-policy/cedar-wasm";
import crypto from "crypto";

export const CEDAR_POLICIES: Record<string, string> = {
  "travel-booking": `
    @id("travel-agent-permit")
    permit (
      principal is Agent,
      action in [Action::"book_flight", Action::"search_flights"],
      resource is TravelSystem
    ) when {
      principal.credentialStatus == "active" &&
      principal.spendCap <= 10000 &&
      context.hourOfDay >= 9 &&
      context.hourOfDay < 17 &&
      context.dayOfWeek in ["Mon", "Tue", "Wed", "Thu", "Fri"]
    };

    @id("travel-agent-forbid-night")
    forbid (
      principal is Agent,
      action in [Action::"book_flight"],
      resource is TravelSystem
    ) when {
      context.hourOfDay < 9 || context.hourOfDay >= 17
    };

    @id("travel-agent-forbid-overspend")
    forbid (
      principal is Agent,
      action in [Action::"execute_payment"],
      resource is PaymentRail
    ) when {
      resource.amount > principal.spendCap
    };
  `,

  "hr-payroll": `
    @id("hr-agent-broad-permit")
    permit (
      principal is Agent,
      action,
      resource
    ) when {
      principal.credentialStatus == "active" &&
      principal.credentialType == "hr-payroll" &&
      resource.domain in ["finance", "hr", "payroll"]
    };

    @id("hr-agent-prohibit-external")
    forbid (
      principal is Agent,
      action in [Action::"execute_payment"],
      resource is ExternalPaymentRail
    ) when {
      resource.domain not in ["finance", "hr", "payroll"]
    };
  `,

  "unverified": `
    @id("rogue-deny-all-payments")
    forbid (
      principal is Agent,
      action in [Action::"execute_payment", Action::"book_flight"],
      resource
    ) when {
      principal.spendCap < resource.amount ||
      principal.credentialType == "unverified"
    };
  `,

  "global-constraints": `
    @id("global-revoked-deny")
    forbid (
      principal is Agent,
      action,
      resource
    ) when {
      principal.credentialStatus == "revoked"
    };

    @id("global-expired-deny")
    forbid (
      principal is Agent,
      action,
      resource
    ) when {
      context.currentTimestamp > principal.credentialExpiresAt
    };
  `,
};

export interface PolicyContext {
  hourOfDay: number;
  dayOfWeek: string;
  currentTimestamp: number;
  requestId: string;
}

export interface PolicyPrincipal {
  did: string;
  credentialStatus: string;
  credentialType: string;
  spendCap: number;
  credentialExpiresAt: number;
}

export interface PolicyResource {
  type: string;
  domain: string;
  amount?: number;
}

export interface PolicyDecision {
  decision: "PERMIT" | "DENY" | "ESCALATE";
  matchedPolicyId: string;
  reason: string;
  policyHash: string;
}

export async function evaluatePolicy(
  principal: PolicyPrincipal,
  action: string,
  resource: PolicyResource,
  context: PolicyContext
): Promise<PolicyDecision> {
  const agentType = principal.credentialType;
  const policyText = [
    CEDAR_POLICIES["global-constraints"],
    CEDAR_POLICIES[agentType] ?? CEDAR_POLICIES["unverified"],
  ].join("\n\n");

  const policyHash = crypto
    .createHash("sha256")
    .update(policyText)
    .digest("hex");

  const entities = buildCedarEntities(principal, resource);

  const cedarRequest = {
    principal: { type: "Agent", id: principal.did },
    action: { type: "Action", id: action },
    resource: { type: resource.type, id: resource.type },
    context: {
      hourOfDay: context.hourOfDay,
      dayOfWeek: context.dayOfWeek,
      currentTimestamp: context.currentTimestamp,
    },
  };

  let decision: "PERMIT" | "DENY" = "DENY";
  let matchedPolicyId = "global-constraints.global-revoked-deny";

  try {
    await cedar.default?.();

    const result = cedar.isAuthorized({
      policies: policyText,
      entities: JSON.stringify(entities),
      principal: JSON.stringify(cedarRequest.principal),
      action: JSON.stringify(cedarRequest.action),
      resource: JSON.stringify(cedarRequest.resource),
      context: JSON.stringify(cedarRequest.context),
    });

    decision = result.decision === "Allow" ? "PERMIT" : "DENY";
    matchedPolicyId = result.diagnostics?.reasons?.[0] ?? "unknown";
  } catch (cedarError: any) {
    console.error("[Cedar] Evaluation error — defaulting to DENY:", cedarError.message);
    return {
      decision: "DENY",
      matchedPolicyId: "eval-error",
      reason: `Policy evaluation failed: ${cedarError.message}. Defaulting to DENY (fail-closed).`,
      policyHash,
    };
  }

  if (
    decision === "PERMIT" &&
    resource.amount !== undefined &&
    principal.spendCap < Infinity &&
    resource.amount >= principal.spendCap * 0.8 &&
    resource.amount <= principal.spendCap
  ) {
    return {
      decision: "ESCALATE",
      matchedPolicyId,
      reason: `Amount ${resource.amount} is within 20% of spend cap ${principal.spendCap}. Human review required.`,
      policyHash,
    };
  }

  return {
    decision,
    matchedPolicyId,
    reason: decision === "PERMIT"
      ? `Action permitted under policy clause: ${matchedPolicyId}`
      : `Action denied: ${matchedPolicyId}`,
    policyHash,
  };
}

function buildCedarEntities(principal: PolicyPrincipal, resource: PolicyResource) {
  return [
    {
      uid: { type: "Agent", id: principal.did },
      attrs: {
        credentialStatus: principal.credentialStatus,
        credentialType: principal.credentialType,
        spendCap: principal.spendCap,
        credentialExpiresAt: principal.credentialExpiresAt,
      },
      parents: [],
    },
    {
      uid: { type: resource.type, id: resource.type },
      attrs: {
        domain: resource.domain,
        amount: resource.amount ?? 0,
      },
      parents: [],
    },
  ];
}