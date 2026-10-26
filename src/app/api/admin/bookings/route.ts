import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { listBookings } from "@/lib/bookings";
import { useSupabase } from "@/lib/supabaseRest";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ bookings: await listBookings() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    // A JSON error the panel can show, not a bare 500 that leaves it stuck on the
    // login screen (what a paused free-plan Supabase project used to cause).
    console.error("[admin] list bookings failed", err);
    const detail = (err instanceof Error ? err.message : String(err)).slice(0, 160);
    return NextResponse.json(
      {
        bookings: [],
        error: useSupabase
          ? `Couldn't reach the Supabase database (${detail}). Free Supabase projects pause after a week without traffic: open supabase.com/dashboard, press Restore project, then Refresh here.`
          : `Couldn't load bookings (${detail}).`,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
