// Server-side store for the booking-alert setup managed from /admin: the
// Telegram bot + the chats it alerts, and the WhatsApp (CallMeBot) number + key.
// Kept apart from the public site options (/api/config) because it holds secrets.
// Same pluggable backend as siteConfig: Supabase first, then Vercel KV / Upstash,
// then a local JSON file. Server-only — import from Route Handlers, never client code.

import { promises as fs } from "fs";
import path from "path";
import { sb, useSupabase } from "./supabaseRest";

export type AlertChat = { id: string; name: string };

export type NotifySettings = {
  telegramToken: string; // from @BotFather; "" = not set up
  telegramBot: { username: string; name: string } | null;
  telegramChats: AlertChat[]; // the people / groups that get the alerts
  whatsappPhone: string; // international format, e.g. +2349043380193
  whatsappKey: string; // the CallMeBot API key for that number
};

export const EMPTY_NOTIFY_SETTINGS: NotifySettings = {
  telegramToken: "",
  telegramBot: null,
  telegramChats: [],
  whatsappPhone: "",
  whatsappKey: "",
};

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKv = Boolean(KV_URL && KV_TOKEN);
const KEY = "notify:settings";
const FILE = path.join(process.cwd(), ".data", "notify.json");

async function kv<T = unknown>(command: (string | number)[]): Promise<T> {
  const res = await fetch(KV_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV request failed: ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

// Throws if the store can't be read — /admin shows that instead of an empty setup
// it might then save over the real one.
export async function loadNotifySettings(): Promise<NotifySettings> {
  let stored: Partial<NotifySettings> | null = null;
  if (useSupabase) {
    const rows = await sb<{ data: Partial<NotifySettings> }[]>(`site_config?key=eq.${KEY}&select=data`);
    stored = rows[0]?.data ?? null;
  } else {
    const raw = useKv ? await kv<string | null>(["GET", KEY]) : await fs.readFile(FILE, "utf8").catch(() => null);
    stored = raw ? (JSON.parse(raw) as Partial<NotifySettings>) : null;
  }
  return { ...EMPTY_NOTIFY_SETTINGS, ...stored };
}

// For sending alerts: never throws. If the store is down this is empty, and the
// alerts fall back to the env vars.
export async function getNotifySettings(): Promise<NotifySettings> {
  try {
    return await loadNotifySettings();
  } catch {
    return EMPTY_NOTIFY_SETTINGS;
  }
}

export async function setNotifySettings(settings: NotifySettings): Promise<void> {
  if (useSupabase) {
    await sb("site_config", {
      method: "POST",
      body: { key: KEY, data: settings },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    return;
  }
  const raw = JSON.stringify(settings);
  if (useKv) {
    await kv(["SET", KEY, raw]);
  } else {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, raw, "utf8");
  }
}
