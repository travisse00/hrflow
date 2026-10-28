import type { Prisma, Role } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import type { CurrentUser } from "@/lib/auth/current-user";
import { dayKeyToDate } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { assertCan, can } from "@/lib/permissions";
import type { CreateEmployeeInput, EmployeeListQuery, UpdateEmployeeInput } from "@/lib/validation/employee";
import { getDepartmentBranchIds } from "../departments/queries";

export const EMPLOYEES_PAGE_SIZE = 10;

const listSelect = {
  id: true,
  fullName: true,
  email: true,
  position: true,
  role: true,
  status: true,
  dateJoined: true,
  department: { select: { id: true, name: true } },
} satisfies Prisma.EmployeeSelect;

export type EmployeeListItem = Prisma.EmployeeGetPayload<{ select: typeof listSelect }>;

async function assertDepartmentExists(departmentId: string | null): Promise<void> {
  if (!departmentId) return;
  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
  if (!dept) {
    throw new AppError("VALIDATION", "That department doesn't exist.", { departmentId: ["Choose an existing department"] });
  }
}

async function assertEmailFree(email: string, excludeId?: string): Promise<void> {
  const clash = await prisma.employee.findFirst({
    where: { email, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { id: true },
  });
  if (clash) {
    throw new AppError("CONFLICT", "An employee with this email already exists.", { email: ["This email is already in use"] });
  }
}

// ───────────── queries ─────────────

export async function listEmployees(actor: CurrentUser, query: EmployeeListQuery) {
  assertCan(actor, "employee:view-all");

  const where: Prisma.EmployeeWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.q
      ? {
          OR: [
            { fullName: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { position: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  // "Employees in Human Resources" includes people in Recruitment, Welfare, etc.
  if (query.department) where.departmentId = { in: await getDepartmentBranchIds(query.department) };

  const [items, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      select: listSelect,
      orderBy: { fullName: "asc" },
      skip: (query.page - 1) * EMPLOYEES_PAGE_SIZE,
      take: EMPLOYEES_PAGE_SIZE,
    }),
    prisma.employee.count({ where }),
  ]);

  return { items, total, page: query.page, pages: Math.max(1, Math.ceil(total / EMPLOYEES_PAGE_SIZE)) };
}

export async function getEmployee(viewer: CurrentUser, id: string) {
  // Everyone may open their OWN profile; anyone else's needs employee:view-all.
  if (viewer.id !== id) assertCan(viewer, "employee:view-all");

  const employee = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      position: true,
      role: true,
      status: true,
      dateJoined: true,
      deactivatedAt: true,
      department: { select: { id: true, name: true } },
      headedDepartments: { select: { id: true, name: true } },
    },
  });
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found.");
  return employee;
}

/**
 * A minimal directory (name, position, department) for pickers: choosing a department
 * head or a message recipient. Deliberately has no email/phone, so it's safe for any signed-in user.
 * At a very large scale this becomes a type-ahead search instead of a full list.
 */
export async function getEmployeeOptions() {
  return prisma.employee.findMany({
    where: { status: "ACTIVE" },
    orderBy: { fullName: "asc" },
    take: 500,
    select: { id: true, fullName: true, position: true },
  });
}

// ───────────── commands ─────────────

export async function createEmployee(actor: CurrentUser, input: CreateEmployeeInput): Promise<{ id: string }> {
  assertCan(actor, "employee:manage");

  const role: Role = input.role ?? "EMPLOYEE";
  if (role !== "EMPLOYEE") assertCan(actor, "employee:assign-role"); // only Admins hand out elevated roles

  await assertEmailFree(input.email);
  await assertDepartmentExists(input.departmentId);

  const employee = await prisma.employee.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      position: input.position,
      role,
      passwordHash: await hashPassword(input.password),
      departmentId: input.departmentId,
      ...(input.dateJoined ? { dateJoined: dayKeyToDate(input.dateJoined) } : {}),
    },
    select: { id: true },
  });

  await logActivity({ actorId: actor.id, action: "EMPLOYEE_CREATED", entityType: "Employee", entityId: employee.id });
  return employee;
}

export async function updateEmployee(actor: CurrentUser, input: UpdateEmployeeInput): Promise<void> {
  assertCan(actor, "employee:manage");

  const target = await prisma.employee.findUnique({ where: { id: input.id }, select: { id: true, role: true } });
  if (!target) throw new AppError("NOT_FOUND", "Employee not found.");

  // An HR Manager must not be able to edit (or take over) an Admin's account.
  if (target.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Only an Admin can edit an Admin account.");
  }

  const roleChanged = input.role !== undefined && input.role !== target.role;
  if (roleChanged) {
    assertCan(actor, "employee:assign-role");
    if (target.id === actor.id) throw new AppError("VALIDATION", "You can't change your own role.", { role: ["You can't change your own role"] });
  }

  await assertEmailFree(input.email, target.id);
  await assertDepartmentExists(input.departmentId);

  await prisma.employee.update({
    where: { id: target.id },
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone ?? null,
      position: input.position,
      departmentId: input.departmentId,
      ...(roleChanged && input.role ? { role: input.role } : {}),
      ...(input.dateJoined ? { dateJoined: dayKeyToDate(input.dateJoined) } : {}),
    },
  });

  await logActivity({
    actorId: actor.id,
    action: "EMPLOYEE_UPDATED",
    entityType: "Employee",
    entityId: target.id,
    metadata: roleChanged ? { roleChangedTo: input.role ?? null } : undefined,
  });
}

/**
 * Deactivate / reactivate. Nothing is deleted: attendance, leave and messages keep pointing
 * at the employee, so history stays intact. A deactivated account can't sign in (the session
 * check reads the database on every request) and stops being offered as a department head.
 */
export async function setEmployeeStatus(actor: CurrentUser, id: string, status: "ACTIVE" | "INACTIVE"): Promise<void> {
  assertCan(actor, "employee:manage");

  if (id === actor.id) throw new AppError("VALIDATION", "You can't deactivate your own account.");

  const target = await prisma.employee.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!target) throw new AppError("NOT_FOUND", "Employee not found.");
  if (target.role === "ADMIN" && actor.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Only an Admin can change an Admin account.");
  }
  if (target.status === status) return; // already in that state: nothing to do

  if (status === "INACTIVE") {
    if (target.role === "ADMIN") {
      const otherAdmins = await prisma.employee.count({ where: { role: "ADMIN", status: "ACTIVE", NOT: { id } } });
      if (otherAdmins === 0) throw new AppError("VALIDATION", "You can't deactivate the last active Admin.");
    }
    // A department head must be an active employee, so release any departments they head.
    const [, released] = await prisma.$transaction([
      prisma.employee.update({ where: { id }, data: { status: "INACTIVE", deactivatedAt: new Date() } }),
      prisma.department.updateMany({ where: { headId: id }, data: { headId: null } }),
    ]);
    await logActivity({
      actorId: actor.id,
      action: "EMPLOYEE_DEACTIVATED",
      entityType: "Employee",
      entityId: id,
      metadata: { departmentsReleased: released.count },
    });
  } else {
    await prisma.employee.update({ where: { id }, data: { status: "ACTIVE", deactivatedAt: null } });
    await logActivity({ actorId: actor.id, action: "EMPLOYEE_REACTIVATED", entityType: "Employee", entityId: id });
  }
}

export const canManageEmployees = (user: CurrentUser): boolean => can(user, "employee:manage");
