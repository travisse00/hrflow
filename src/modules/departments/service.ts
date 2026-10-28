import type { Department } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { assertCan, can } from "@/lib/permissions";
import type { DepartmentInput, UpdateDepartmentInput } from "@/lib/validation/dapartment";

// ───────────── helpers ─────────────

async function getDepartmentOrThrow(id: string): Promise<Department> {
  const dept = await prisma.department.findUnique({ where: { id } });
  if (!dept) throw new AppError("NOT_FOUND", "Department not found.");
  return dept;
}

async function getParentOrNull(parentId: string | null): Promise<Department | null> {
  if (!parentId) return null;
  const parent = await prisma.department.findUnique({ where: { id: parentId } });
  if (!parent) {
    throw new AppError("VALIDATION", "Parent department not found.", { parentId: ["Choose an existing department"] });
  }
  return parent;
}

async function assertActiveHead(headId: string | null): Promise<void> {
  if (!headId) return;
  const employee = await prisma.employee.findUnique({ where: { id: headId }, select: { status: true } });
  if (!employee || employee.status !== "ACTIVE") {
    throw new AppError("VALIDATION", "A department head must be an active employee.", {
      headId: ["Choose an active employee"],
    });
  }
}

// Two siblings under the same parent can't share a name (case-insensitive).
async function assertSiblingNameFree(name: string, parent: Department | null, excludeId?: string): Promise<void> {
  const clash = await prisma.department.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      depth: parent ? parent.depth + 1 : 0,
      ...(parent ? { parentId: parent.id } : {}),
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new AppError("CONFLICT", "A department with that name already exists here.", {
      name: ["Name already used under this parent"],
    });
  }
}

// The ancestor list for a child = its parent's id, then the parent's own ancestors.
function pathUnder(parent: Department | null): string[] {
  return parent ? [parent.id, ...parent.path] : [];
}

// ───────────── commands ─────────────

export async function createDepartment(actor: CurrentUser, input: DepartmentInput): Promise<{ id: string }> {
  assertCan(actor, "department:manage");

  const parent = await getParentOrNull(input.parentId);
  await assertActiveHead(input.headId);
  await assertSiblingNameFree(input.name, parent);

  const dept = await prisma.department.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      parentId: parent?.id ?? null,
      path: pathUnder(parent),
      depth: parent ? parent.depth + 1 : 0,
      headId: input.headId,
    },
    select: { id: true },
  });

  await logActivity({ actorId: actor.id, action: "DEPARTMENT_CREATED", entityType: "Department", entityId: dept.id });
  return dept;
}

/** Edit details, change head, and/or MOVE the department to a new parent. */
export async function updateDepartment(actor: CurrentUser, input: UpdateDepartmentInput): Promise<void> {
  assertCan(actor, "department:manage");

  const current = await getDepartmentOrThrow(input.id);
  const newParent = await getParentOrNull(input.parentId);

  // ── Cycle prevention ──
  if (newParent) {
    if (newParent.id === current.id) {
      throw new AppError("VALIDATION", "A department cannot be its own parent.", {
        parentId: ["A department cannot be its own parent"],
      });
    }
    // newParent.path lists every ancestor of newParent. If `current` is in there,
    // newParent sits somewhere BELOW current, and moving would create a loop.
    if (newParent.path.includes(current.id)) {
      throw new AppError("VALIDATION", "A department cannot be moved inside its own sub-departments.", {
        parentId: ["Choose a parent outside this department's branch"],
      });
    }
  }

  if (input.headId !== current.headId) await assertActiveHead(input.headId);
  await assertSiblingNameFree(input.name, newParent, current.id);

  const parentChanged = (newParent?.id ?? null) !== current.parentId;
  const newPath = pathUnder(newParent);
  const newDepth = newParent ? newParent.depth + 1 : 0;

  const updates = [
    prisma.department.update({
      where: { id: current.id },
      data: {
        name: input.name,
        description: input.description ?? null,
        headId: input.headId,
        ...(parentChanged ? { parentId: newParent?.id ?? null, path: newPath, depth: newDepth } : {}),
      },
    }),
  ];

  // When a branch moves, every department under it needs its stored ancestor list and
  // depth rewritten too, otherwise "walk up the tree" would give stale answers.
  if (parentChanged) {
    const descendants = await prisma.department.findMany({ where: { path: { has: current.id } } });
    const depthShift = newDepth - current.depth;
    for (const d of descendants) {
      const at = d.path.indexOf(current.id);
      updates.push(
        prisma.department.update({
          where: { id: d.id },
          data: { path: [...d.path.slice(0, at + 1), ...newPath], depth: d.depth + depthShift },
        }),
      );
    }
  }

  await prisma.$transaction(updates); // all-or-nothing: no half-moved branches

  await logActivity({
    actorId: actor.id,
    action: parentChanged ? "DEPARTMENT_MOVED" : "DEPARTMENT_UPDATED",
    entityType: "Department",
    entityId: current.id,
    metadata: parentChanged ? { from: current.parentId, to: newParent?.id ?? null } : undefined,
  });
}

export async function assignEmployeeToDepartment(
  actor: CurrentUser,
  employeeId: string,
  departmentId: string | null,
): Promise<void> {
  assertCan(actor, "department:manage");

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { status: true },
  });
  if (!employee) throw new AppError("NOT_FOUND", "Employee not found.");
  if (employee.status !== "ACTIVE") {
    throw new AppError("VALIDATION", "Inactive employees can't be reassigned.");
  }
  if (departmentId) await getDepartmentOrThrow(departmentId);

  await prisma.employee.update({ where: { id: employeeId }, data: { departmentId } });
  await logActivity({
    actorId: actor.id,
    action: "EMPLOYEE_ASSIGNED_TO_DEPARTMENT",
    entityType: "Employee",
    entityId: employeeId,
    metadata: { departmentId },
  });
}

// ───────────── queries ─────────────

export interface DepartmentNode {
  id: string;
  name: string;
  description: string | null;
  depth: number;
  parentId: string | null;
  head: { id: string; fullName: string } | null;
  memberCount: number;
  children: DepartmentNode[];
}

/** The whole org tree in ONE database query; nesting is built in memory. */
export async function getDepartmentTree(): Promise<DepartmentNode[]> {
  const rows = await prisma.department.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      depth: true,
      parentId: true,
      head: { select: { id: true, fullName: true } },
      _count: { select: { members: true } },
    },
  });

  const nodes = new Map<string, DepartmentNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      name: r.name,
      description: r.description,
      depth: r.depth,
      parentId: r.parentId,
      head: r.head,
      memberCount: r._count.members,
      children: [],
    });
  }
  const roots: DepartmentNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  return roots;
}

export async function getDepartmentDetail(viewer: CurrentUser, id: string) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: {
      head: { select: { id: true, fullName: true, email: true } },
      children: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, _count: { select: { members: true } } },
      },
    },
  });
  if (!dept) throw new AppError("NOT_FOUND", "Department not found.");

  // Backward link: path is nearest-parent-first; reverse it for a root -> leaf breadcrumb.
  const ancestorRows = dept.path.length
    ? await prisma.department.findMany({ where: { id: { in: dept.path } }, select: { id: true, name: true } })
    : [];
  const ancestors = dept.path
    .map((pid) => ancestorRows.find((a) => a.id === pid))
    .filter((a): a is { id: string; name: string } => Boolean(a))
    .reverse();

  // Everyone can see the org structure. The member list is private to HR/Admin and to
  // people who actually belong to this department.
  const canSeeMembers = can(viewer, "employee:view-all") || viewer.departmentId === id;
  const members = canSeeMembers
    ? await prisma.employee.findMany({
        where: { departmentId: id, status: "ACTIVE" },
        orderBy: { fullName: "asc" },
        take: 200,
        select: { id: true, fullName: true, position: true, email: true },
      })
    : null;

  return { department: dept, ancestors, members };
}