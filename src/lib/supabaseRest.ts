// Tiny PostgREST client for the ApexRide Supabase project. Server-only.
//
// Uses the service-role key, which bypasses RLS — both tables have RLS enabled
// with no policies, so this key is the only way in. Never expose it to the
// client; it lives in SUPABASE_SERVICE_ROLE_KEY.

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const useSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

export async function sb<T = unknown>(
  pathAndQuery: string,
  init?: { method?: string; body?: unknown; prefer?: string },
): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    method: init?.method ?? "GET",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.prefer ? { Prefer: init.prefer } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase request failed: ${res.status} ${await res.text().catch(() => "")}`);
  if (res.status === 204 || init?.prefer === "return=minimal") return undefined as T;
  return (await res.json()) as T;
}
