import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

interface AuditInput {
  actorId?: string;
  action: string; // e.g. "EMPLOYEE_REGISTERED", "LEAVE_APPROVED"
  entityType: string; // e.g. "Employee", "LeaveRequest"
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Best-effort: a failed audit write is logged but never breaks the real operation. */
export async function logActivity(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({ data: input });
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}
