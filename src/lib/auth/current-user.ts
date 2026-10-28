import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { getSessionPayload } from "./session";

// Never select passwordHash here, so it can't accidentally reach a component.
export const currentUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  position: true,
  departmentId: true,
  profileImage: true,
} satisfies Prisma.EmployeeSelect;

export type CurrentUser = Prisma.EmployeeGetPayload<{ select: typeof currentUserSelect }>;

/**
 * Resolves the signed-in employee FROM THE DATABASE on every request (cached per
 * request by React). So if an admin deactivates someone or changes their role,
 * it takes effect immediately, even though their cookie is still valid.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSessionPayload();
  if (!session) return null;
  const user = await prisma.employee.findUnique({
    where: { id: session.userId },
    select: currentUserSelect,
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
});

/** For pages / layouts: send anonymous visitors to the login page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function requireUserForAction(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED", "Please sign in to continue.");
  return user;
}
