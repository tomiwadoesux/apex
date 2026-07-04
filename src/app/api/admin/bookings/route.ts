import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { listBookings } from "@/lib/bookings";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ bookings: await listBookings() }, { headers: { "Cache-Control": "no-store" } });
}
