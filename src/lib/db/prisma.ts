import { PrismaClient } from "@prisma/client";

// In dev, Next.js hot-reloads modules and would open a new DB connection pool on
// every reload. Stashing the client on globalThis keeps it to one.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
