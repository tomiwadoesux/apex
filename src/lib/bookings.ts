// Server-side booking store. Saves each booking the customer makes under a unique,
// non-repeating reference, and looks it up again for /check-booking and the QR page.
//
// Storage is pluggable:
//   • If Vercel KV / Upstash Redis env vars are present, it uses that (persists in
//     production — Vercel's filesystem is ephemeral, so this is the deploy path).
//   • Otherwise it falls back to a local JSON file under .data/ so the whole flow
//     works in `next dev` with zero setup.
//
// This module is server-only (it touches the filesystem) — import it from Route
// Handlers / Server Components only, never from client code.

import { promises as fs } from "fs";
import path from "path";

/* ── the saved booking — everything the ride-pass card needs to render ─────── */
export type Booking = {
  id: string; // display reference, e.g. "APX-482719"
  createdAt: number;
  passenger: { name: string; phone: string; email: string };
  car: { name: string; klass: string; image: string | null }; // image: relative to /images, e.g. "cars/Range Rover Velar/side.webp"
  service: string; // e.g. "Airport Transfer"
  pickup: string;
  dropoff: string | null;
  duration: string | null;
  date: string; // human-readable, e.g. "Sat, 21 Jun 2026"
  time: string; // "18:30"
  light: boolean; // theme the card was created in
};

export type BookingInput = Omit<Booking, "id" | "createdAt">;

/* ── storage backend selection ─────────────────────────────────────────────── */
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKv = Boolean(KV_URL && KV_TOKEN);

const PREFIX = "booking:";
const keyFor = (digits: string) => `${PREFIX}${digits}`;
// Booking references are stored/looked-up by their digits only, so a customer can
// type "APX-482719", "482719", or "apx 482719" and still find their card.
const digitsOf = (ref: string) => ref.replace(/\D/g, "");

/* ── Upstash/Vercel KV REST (one fetch per command) ────────────────────────── */
async function kv<T = unknown>(command: (string | number)[]): Promise<T> {
  const res = await fetch(KV_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  const data = (await res.json()) as { result: T };
  return data.result;
}

/* ── local JSON file (dev fallback) ────────────────────────────────────────── */
const FILE = path.join(process.cwd(), ".data", "bookings.json");
async function readFile(): Promise<Record<string, Booking>> {
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8")) as Record<string, Booking>;
  } catch {
    return {};
  }
}
async function writeFile(all: Record<string, Booking>): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2), "utf8");
}

/* ── public API ────────────────────────────────────────────────────────────── */
export async function getBooking(ref: string): Promise<Booking | null> {
  const digits = digitsOf(ref);
  if (!digits) return null;
  if (useKv) {
    const raw = await kv<string | null>(["GET", keyFor(digits)]);
    return raw ? (JSON.parse(raw) as Booking) : null;
  }
  const all = await readFile();
  return all[digits] ?? null;
}

async function refExists(digits: string): Promise<boolean> {
  if (useKv) return (await kv<number>(["EXISTS", keyFor(digits)])) === 1;
  const all = await readFile();
  return Boolean(all[digits]);
}

export async function createBooking(input: BookingInput): Promise<Booking> {
  // Random 6-digit reference, retried until it doesn't collide with an existing one.
  for (let attempt = 0; attempt < 25; attempt++) {
    const digits = String(Math.floor(100000 + Math.random() * 900000));
    if (await refExists(digits)) continue;
    const booking: Booking = { ...input, id: `APX-${digits}`, createdAt: Date.now() };
    if (useKv) {
      await kv(["SET", keyFor(digits), JSON.stringify(booking)]);
    } else {
      const all = await readFile();
      all[digits] = booking;
      await writeFile(all);
    }
    return booking;
  }
  throw new Error("Could not allocate a unique booking reference");
}
