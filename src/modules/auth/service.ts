import type { Role } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth";

interface AuthResult {
  id: string;
  role: Role;
}

/**
 * Self-registration. The very first account in an empty system becomes ADMIN
 * (bootstrap); everyone after that is an EMPLOYEE until an Admin promotes them.
 */
export async function registerEmployee(input: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.employee.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("CONFLICT", "An account with this email already exists.", {
      email: ["This email is already registered"],
    });
  }

  const passwordHash = await hashPassword(input.password);
  const isFirstUser = (await prisma.employee.count()) === 0;

  // If two people register the same email at once, the unique index on `email`
  // rejects the second insert (P2002) and safeAction reports it as a conflict.
  const employee = await prisma.employee.create({
    data: {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      position: input.position ?? "Staff",
      passwordHash,
      role: isFirstUser ? "ADMIN" : "EMPLOYEE",
    },
    select: { id: true, role: true },
  });

  await logActivity({
    actorId: employee.id,
    action: "EMPLOYEE_REGISTERED",
    entityType: "Employee",
    entityId: employee.id,
    metadata: { role: employee.role },
  });

  return employee;
}

// Compared against when the email doesn't exist, so "unknown email" and
// "wrong password" take about the same time (prevents account enumeration by timing).
const dummyHash = hashPassword("not-a-real-password");

export async function authenticate(input: LoginInput): Promise<AuthResult> {
  const employee = await prisma.employee.findUnique({
    where: { email: input.email },
    select: { id: true, role: true, status: true, passwordHash: true },
  });

  const hash = employee?.passwordHash ?? (await dummyHash);
  const passwordOk = await verifyPassword(input.password, hash);

  // One generic message for every failure: never reveal which part was wrong.
  if (!employee || !passwordOk || employee.status !== "ACTIVE") {
    throw new AppError("UNAUTHENTICATED", "Invalid email or password.");
  }

  await logActivity({
    actorId: employee.id,
    action: "LOGIN",
    entityType: "Employee",
    entityId: employee.id,
  });

  return { id: employee.id, role: employee.role };
}
