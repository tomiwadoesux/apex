// Minimal admin session: the password lives in the ADMIN_PASSWORD env var and a
// successful login sets an HMAC-signed httpOnly cookie. Server-only.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "apex_admin";

function secret(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

function sign(value: string): string {
  return createHmac("sha256", secret() ?? "").update(value).digest("hex");
}

export function checkPassword(password: string): boolean {
  const s = secret();
  if (!s) return false; // admin disabled until ADMIN_PASSWORD is set
  const a = Buffer.from(password);
  const b = Buffer.from(s);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function makeSessionToken(): string {
  const payload = `admin:${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

export async function isAdmin(): Promise<boolean> {
  if (!secret()) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
