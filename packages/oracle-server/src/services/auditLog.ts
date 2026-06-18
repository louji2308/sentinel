import type { AuditLogEntry } from "@sentinel/t3-client";

const auditLog: AuditLogEntry[] = [];

export function appendEntry(entry: AuditLogEntry): void {
  auditLog.push(entry);
}

export function getLog(): AuditLogEntry[] {
  return auditLog;
}

export function getLogSince(timestamp: number): AuditLogEntry[] {
  return auditLog.filter((e) => e.timestamp >= timestamp);
}

export function findEntry(receiptId: string): AuditLogEntry | undefined {
  return auditLog.find((e) => e.receiptId === receiptId);
}