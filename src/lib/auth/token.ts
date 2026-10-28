// Edge-safe: only depends on `jose`, so middleware can import it too.
import type { Role } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "hrflow_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  userId: string;
  role: Role; // convenience only; the DB is always the source of truth for permissions
}

function getKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to a string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getKey());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.role !== "string") return null;
    return { userId: payload.sub, role: payload.role as Role };
  } catch {
    return null; // expired, tampered, malformed: all just "not signed in"
  }
}
