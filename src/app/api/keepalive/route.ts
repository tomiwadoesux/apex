// GET /api/keepalive — run once a day by Vercel Cron (see vercel.json). Free
// Supabase projects pause after a week without traffic, which takes booking
// saves and /admin down with them; one tiny query a day keeps the database awake.

import { sb, useSupabase } from "@/lib/supabaseRest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // When CRON_SECRET is set, Vercel Cron sends it as a Bearer token.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  if (!useSupabase) return Response.json({ ok: true, skipped: "Supabase not configured" });
  try {
    await sb("bookings?select=digits&limit=1");
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[keepalive] Supabase ping failed", err);
    return Response.json({ ok: false }, { status: 503 });
  }
}
