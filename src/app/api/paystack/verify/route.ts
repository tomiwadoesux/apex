// POST /api/paystack/verify { reference } — confirm a Paystack transaction server
// -side, then mark the booking paid and alert the team. The client never decides
// payment succeeded; this route (with the secret key) is the only authority.

import { getBooking, updateBooking } from "@/lib/bookings";
import { verifyTransaction, paystackConfigured } from "@/lib/paystack";
import { notifyPaymentReceived } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!paystackConfigured()) {
    return Response.json({ ok: false, error: "Payments not configured" }, { status: 503 });
  }
  let body: { reference?: unknown };
  try {
    body = (await request.json()) as { reference?: unknown };
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const reference = typeof body.reference === "string" ? body.reference : "";
  if (!reference) return Response.json({ ok: false, error: "Missing reference" }, { status: 400 });

  let tx;
  try {
    tx = await verifyTransaction(reference);
  } catch (err) {
    console.error("[paystack] verify failed", err);
    return Response.json({ ok: false, error: "Verification failed" }, { status: 502 });
  }
  if (!tx || tx.status !== "success") {
    return Response.json({ ok: false, error: "Payment not successful" }, { status: 402 });
  }

  const bookingId = tx.metadata?.bookingId;
  if (!bookingId) return Response.json({ ok: false, error: "No booking on transaction" }, { status: 400 });

  const booking = await getBooking(bookingId);
  if (!booking) return Response.json({ ok: false, error: "Booking not found" }, { status: 404 });

  // Guard against a tampered client amount: the money received must cover the fare.
  if (booking.amount && tx.amount < Math.round(booking.amount * 100)) {
    return Response.json({ ok: false, error: "Amount paid is less than the fare" }, { status: 402 });
  }

  const naira = Math.round(tx.amount / 100);
  const note = `Paid ₦${naira.toLocaleString("en-NG")} via Paystack · ref ${tx.reference}`;
  const updated = (await updateBooking(bookingId, { paid: true, paymentNote: note })) ?? { ...booking, paid: true, paymentNote: note };
  await notifyPaymentReceived(updated);

  return Response.json({ ok: true, bookingId });
}
