// POST /api/bookings/[id]/payment — the guest has transferred the fare and is
// submitting their receipt + note for an already-created booking. Saves the note
// on the booking and emails the team the receipt. Kept separate from booking
// creation so payment can happen later (and persist until it does).

import { getBooking, updateBooking } from "@/lib/bookings";
import { notifyPaymentReceived } from "@/lib/notify";

export const runtime = "nodejs";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const strOrNull = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.slice(0, max) : null);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const booking = await getBooking(id);
  if (!booking) return Response.json({ error: "Booking not found" }, { status: 404 });

  const paymentNote = strOrNull(body.paymentNote, 400);
  const receipt = typeof body.receipt === "string" && body.receipt.startsWith("data:image/") ? body.receipt : null;
  const receiptName = str(body.receiptName, 120) || null;

  const updated = (await updateBooking(id, { paymentNote })) ?? { ...booking, paymentNote };
  await notifyPaymentReceived(updated, { receipt, receiptName });

  return Response.json({ ok: true });
}
