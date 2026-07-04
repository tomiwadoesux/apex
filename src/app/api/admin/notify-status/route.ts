import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { notificationStatus, sendTestNotifications } from "@/lib/notify";

export const runtime = "nodejs";

// GET — which notification channels the server has configured (booleans only).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(notificationStatus(), { headers: { "Cache-Control": "no-store" } });
}

// POST — fire a test email + push and report per-channel results.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ results: await sendTestNotifications() });
}
