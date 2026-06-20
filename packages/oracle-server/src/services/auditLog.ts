import { insertAuditEntry, getAuditLog, findAuditEntry } from "./db.js";
import type { AuditLogEntry } from "@sentinel/t3-client";

export function appendEntry(entry: AuditLogEntry): void {
  insertAuditEntry({
    id: entry.id,
    timestamp: entry.timestamp,
    agentDid: entry.agentDid,
    decision: entry.decision,
    policyClause: entry.policyClause,
    action: entry.action,
    receiptId: entry.receiptId,
    operatorAction: entry.operatorAction,
  });
}

export function getLog(): AuditLogEntry[] {
  return getAuditLog(0, 500) as unknown as AuditLogEntry[];
}

export function getLogSince(timestamp: number): AuditLogEntry[] {
  return getAuditLog(timestamp, 200) as unknown as AuditLogEntry[];
}

export function findEntry(receiptId: string): AuditLogEntry | undefined {
  const entry = findAuditEntry(receiptId);
  return entry as AuditLogEntry | undefined;
}

export function clearCache(): void {
  // No-op — SQLite persists intentionally
}
