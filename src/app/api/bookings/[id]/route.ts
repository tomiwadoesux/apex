// GET /api/bookings/[id] — look a booking up by its reference (digits or "APX-…").

import { getBooking } from "@/lib/bookings";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const booking = await getBooking(id);
    if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });
    return Response.json({ booking });
  } catch (err) {
    console.error("[bookings] lookup failed", err);
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }
}
