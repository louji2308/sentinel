import * as cedar from "@cedar-policy/cedar-wasm";
import type { CedarValueJson } from "@cedar-policy/cedar-wasm";
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
      principal.spendCap <= 10000
    };

    @id("travel-agent-permit-payment")
    permit (
      principal is Agent,
      action in [Action::"execute_payment"],
      resource is PaymentRail
    ) when {
      principal.credentialStatus == "active" &&
      resource.amount <= principal.spendCap
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
      ["finance", "hr", "payroll"].contains(resource.domain)
    };

    @id("hr-agent-prohibit-external")
    forbid (
      principal is Agent,
      action in [Action::"execute_payment"],
      resource is ExternalPaymentRail
    ) when {
      !(["finance", "hr", "payroll"].contains(resource.domain))
    };
  `,

  "expense-processing": `
    @id("expense-agent-permit")
    permit (
      principal is Agent,
      action in [Action::"submit_expense"],
      resource
    ) when {
      principal.credentialStatus == "active" &&
      principal.credentialType == "expense-processing"
    };

    @id("expense-agent-forbid-external")
    forbid (
      principal is Agent,
      action in [Action::"submit_expense"],
      resource is ExternalPaymentRail
    ) when {
      resource.amount > principal.spendCap
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
  spendDaily?: number;
  spendHourly?: number;
  spendCap?: number;
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
    const result = cedar.isAuthorized({
      policies: { staticPolicies: policyText },
      entities,
      principal: cedarRequest.principal,
      action: cedarRequest.action,
      resource: cedarRequest.resource,
      context: cedarRequest.context,
    });

    if (result.type === "failure") {
      return {
        decision: "DENY",
        matchedPolicyId: "eval-error",
        reason: `Policy evaluation failed: ${result.errors.map(e => e.message ?? String(e)).join("; ")}. Defaulting to DENY (fail-closed).`,
        policyHash,
      };
    }

    decision = result.response.decision === "allow" ? "PERMIT" : "DENY";
    const reasons = result.response.diagnostics?.reason;
    matchedPolicyId = reasons?.[0] ?? (decision === "DENY" ? "implicit-deny" : "unknown");
  } catch (cedarError: any) {
    console.error("[Cedar] Evaluation error — defaulting to DENY:", cedarError.message);
    return {
      decision: "DENY",
      matchedPolicyId: "eval-error",
      reason: `Policy evaluation failed: ${cedarError.message}. Defaulting to DENY (fail-closed).`,
      policyHash,
    };
  }

  if (decision === "PERMIT" && resource.amount !== undefined && principal.spendCap < Infinity) {
    const dailyTotal = (context.spendDaily ?? 0) + resource.amount;
    const hourlyTotal = (context.spendHourly ?? 0) + resource.amount;
    const hourlyCap = Math.floor((context.spendCap ?? principal.spendCap) / 10);

    if (dailyTotal > principal.spendCap) {
      if (dailyTotal <= principal.spendCap * 1.2) {
        return {
          decision: "ESCALATE",
          matchedPolicyId,
          reason: `Daily spend $${dailyTotal} exceeds cap $${principal.spendCap}. Escalating.`,
          policyHash,
        };
      }
      return {
        decision: "DENY",
        matchedPolicyId,
        reason: `Daily spend $${dailyTotal} exceeds hard cap $${principal.spendCap}. Denied.`,
        policyHash,
      };
    }

    if (hourlyCap > 0 && hourlyTotal > hourlyCap) {
      return {
        decision: "ESCALATE",
        matchedPolicyId,
        reason: `Hourly burst $${hourlyTotal} exceeds ${hourlyCap}. Escalating.`,
        policyHash,
      };
    }

    if (dailyTotal >= principal.spendCap * 0.8) {
      return {
        decision: "ESCALATE",
        matchedPolicyId,
        reason: `Daily spend $${dailyTotal} is within 20% of cap $${principal.spendCap}. Escalating.`,
        policyHash,
      };
    }
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
      } as Record<string, CedarValueJson>,
      parents: [],
    },
    {
      uid: { type: resource.type, id: resource.type },
      attrs: {
        domain: resource.domain,
        amount: resource.amount ?? 0,
      } as Record<string, CedarValueJson>,
      parents: [],
    },
  ];
}