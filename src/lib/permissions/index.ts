import type { Role } from "@prisma/client";
import { AppError } from "@/lib/errors";

/**
 * Permissions describe WHAT someone may do in general. "Is this THEIR leave request?"
 * or "is this THEIR department?" are ownership checks, done inside each service.
 */
export const PERMISSIONS = [
  "employee:view-all", // see every employee profile
  "employee:manage", // create / edit / deactivate employees
  "employee:assign-role", // change someone's role (Admin only)
  "department:manage", // create / edit / move departments, assign heads
  "attendance:view-all", // org-wide attendance + stats
  "leave:view-all", // see everyone's leave requests
  "leave:review", // approve / reject
  "audit:view", // read the audit log
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  HR_MANAGER: [
    "employee:view-all",
    "employee:manage",
    "department:manage",
    "attendance:view-all",
    "leave:view-all",
    "leave:review",
    "audit:view",
  ],
  EMPLOYEE: [],
};

export function can(user: { role: Role }, permission: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

/** Call at the top of every server action / service that needs a permission. */
export function assertCan(user: { role: Role }, permission: Permission): void {
  if (!can(user, permission)) {
    throw new AppError("FORBIDDEN", "You don't have permission to do that.");
  }
}
