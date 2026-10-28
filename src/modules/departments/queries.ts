import { prisma } from "@/lib/db/prisma";
import { getDepartmentTree, type DepartmentNode } from "./service";

export interface DepartmentOption {
  id: string;
  name: string;
  depth: number;
}

/** A department plus every department below it (uses the stored ancestor `path`: one query). */
export async function getDepartmentBranchIds(departmentId: string): Promise<string[]> {
  const rows = await prisma.department.findMany({
    where: { OR: [{ id: departmentId }, { path: { has: departmentId } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** The tree flattened in display order, for <select> boxes ("— Recruitment" under "Human Resources"). */
export function flattenTree(nodes: DepartmentNode[]): DepartmentOption[] {
  const out: DepartmentOption[] = [];
  const walk = (list: DepartmentNode[]) => {
    for (const n of list) {
      out.push({ id: n.id, name: n.name, depth: n.depth });
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export async function getDepartmentOptions(): Promise<DepartmentOption[]> {
  return flattenTree(await getDepartmentTree());
}

export const optionLabel = (o: DepartmentOption): string => `${"— ".repeat(o.depth)}${o.name}`;
