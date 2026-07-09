import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { updateBooking } from "@/lib/bookings";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/siteConfigDefaults";

// PATCH { status?, driver?, notes?, paid? } — the /admin panel's booking updates.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    status?: BookingStatus;
    driver?: string;
    notes?: string;
    paid?: boolean;
  };
  const patch: Parameters<typeof updateBooking>[1] = {};
  if (body.status !== undefined) {
    if (!BOOKING_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Bad status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.driver !== undefined) patch.driver = String(body.driver).slice(0, 120);
  if (body.notes !== undefined) patch.notes = String(body.notes).slice(0, 2000);
  if (body.paid !== undefined) patch.paid = Boolean(body.paid);
  const booking = await updateBooking(id, patch);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ booking });
}
