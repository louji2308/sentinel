import crypto from "crypto";

const WEBHOOK_URL = process.env.ESCALATE_WEBHOOK_URL;
const WEBHOOK_SECRET = process.env.ESCALATE_WEBHOOK_SECRET;

export interface EscalationEvent {
  eventType: "escalation.created" | "escalation.resolved";
  escalationId: string;
  agentDid: string;
  requestId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: number;
  resolvedAt?: number;
  resolution?: string;
  resolvedBy?: string;
  dashboardUrl: string;
}

export async function notifyEscalation(event: EscalationEvent): Promise<void> {
  if (!WEBHOOK_URL) return;

  const payload = JSON.stringify({
    ...event,
    timestamp: Date.now(),
    source: "sentinel-oracle",
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "SENTINEL-Oracle/3.0",
  };

  if (WEBHOOK_SECRET) {
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(payload);
    headers["X-Sentinel-Signature"] = `sha256=${hmac.digest("hex")}`;
  }

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[Webhook] Delivery failed: ${res.status} ${res.statusText}`);
    } else {
      console.log(`[Webhook] Delivered ${event.eventType} for ${event.escalationId}`);
    }
  } catch (err: any) {
    console.warn(`[Webhook] Delivery error (non-fatal): ${err.message}`);
  }
}

export async function notifySlack(event: EscalationEvent): Promise<void> {
  const SLACK_URL = process.env.ESCALATE_SLACK_WEBHOOK_URL;
  if (!SLACK_URL) return;

  const emoji = event.eventType === "escalation.created" ? "\u26a0\ufe0f" : "\u2705";
  const color = event.eventType === "escalation.created" ? "#ff9900" : "#36a64f";

  const payload = JSON.stringify({
    attachments: [{
      color,
      title: `${emoji} SENTINEL Escalation: ${event.eventType}`,
      fields: [
        { title: "Escalation ID", value: event.escalationId, short: true },
        { title: "Agent", value: event.agentDid.split(":").pop(), short: true },
        { title: "Amount", value: `$${event.amount.toLocaleString()}`, short: true },
        { title: "Status", value: event.status.toUpperCase(), short: true },
        { title: "Reason", value: event.reason, short: false },
      ],
      actions: [{
        type: "button",
        text: "View Dashboard",
        url: event.dashboardUrl,
      }],
      ts: Math.floor(event.createdAt / 1000),
    }],
  });

  try {
    await fetch(SLACK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
  } catch {}
}
