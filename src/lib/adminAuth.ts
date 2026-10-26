// Minimal admin session: the password comes from the ADMIN_PASSWORD env var
// (falling back to the owner-chosen default below) and a successful login sets
// an HMAC-signed httpOnly cookie. Server-only.

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "apex_admin";

// Trimmed on both sides of the comparison: a value pasted into Vercel with a
// trailing space/newline, or a phone keyboard's auto-added space, would
// otherwise never match.
function secret(): string | null {
  return process.env.ADMIN_PASSWORD?.trim() || "password";
}

function sign(value: string): string {
  return createHmac("sha256", secret() ?? "").update(value).digest("hex");
}

export function checkPassword(password: string): boolean {
  const s = secret();
  if (!s) return false; // admin disabled until ADMIN_PASSWORD is set
  const a = Buffer.from(password.trim());
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
