import type { AuditLogEntry } from "@sentinel/t3-client";

const auditLog: AuditLogEntry[] = [];

const MAX_CACHE_SIZE = 500;

export function appendEntry(entry: AuditLogEntry): void {
  auditLog.push(entry);
  if (auditLog.length > MAX_CACHE_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_CACHE_SIZE);
  }
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

export function clearCache(): void {
  auditLog.length = 0;
}
