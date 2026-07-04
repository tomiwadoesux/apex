// Server-side store for the admin-editable site options. Same pluggable backend
// as bookings: Supabase first, then Vercel KV / Upstash, then a local JSON file.
// Server-only — import from Route Handlers, never client code.

import { promises as fs } from "fs";
import path from "path";
import { sb, useSupabase } from "./supabaseRest";
import { DEFAULT_CONFIG, type SiteConfig } from "./siteConfigDefaults";

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKv = Boolean(KV_URL && KV_TOKEN);
const KEY = "site:config";
const FILE = path.join(process.cwd(), ".data", "config.json");

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

// Stored overrides are merged over the code defaults so newly-added fields
// always have a value even if the saved blob predates them.
export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    if (useSupabase) {
      const rows = await sb<{ data: Partial<SiteConfig> }[]>(`site_config?key=eq.${KEY}&select=data`);
      return rows[0] ? { ...DEFAULT_CONFIG, ...rows[0].data } : DEFAULT_CONFIG;
    }
    let raw: string | null = null;
    if (useKv) {
      raw = await kv<string | null>(["GET", KEY]);
    } else {
      raw = await fs.readFile(FILE, "utf8").catch(() => null);
    }
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<SiteConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setSiteConfig(config: SiteConfig): Promise<void> {
  if (useSupabase) {
    await sb("site_config", {
      method: "POST",
      body: { key: KEY, data: config },
      prefer: "resolution=merge-duplicates,return=minimal",
    });
    return;
  }
  const raw = JSON.stringify(config);
  if (useKv) {
    await kv(["SET", KEY, raw]);
  } else {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, raw, "utf8");
  }
}
