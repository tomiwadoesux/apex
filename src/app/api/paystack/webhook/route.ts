// POST /api/paystack/webhook — Paystack calls this server-to-server whenever a
// transaction changes. It's the reliable confirmation (fires even if the guest
// closes their browser before the inline callback runs). We verify the request
// really came from Paystack via the x-paystack-signature HMAC, then mark the
// booking paid on charge.success. Set this URL in Paystack → Settings → Webhooks.

import crypto from "crypto";
import { getBooking, updateBooking } from "@/lib/bookings";
import { notifyPaymentReceived } from "@/lib/notify";

export const runtime = "nodejs";

const SECRET = process.env.PAYSTACK_SECRET_KEY;

export async function POST(request: Request) {
  const raw = await request.text();

  // Reject anything not signed with our secret key.
  if (!SECRET) return Response.json({ ok: false }, { status: 503 });
  const signature = request.headers.get("x-paystack-signature") || "";
  const expected = crypto.createHmac("sha512", SECRET).update(raw).digest("hex");
  if (signature !== expected) return Response.json({ ok: false }, { status: 401 });

  let event: { event?: string; data?: { metadata?: { bookingId?: string }; amount?: number; reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Always 200 the webhook once the signature is valid, so Paystack stops retrying;
  // anything we can't act on is simply ignored.
  if (event.event !== "charge.success") return Response.json({ ok: true });

  const bookingId = event.data?.metadata?.bookingId;
  if (!bookingId) return Response.json({ ok: true });

  const booking = await getBooking(bookingId);
  if (!booking || booking.paid) return Response.json({ ok: true }); // unknown or already handled

  const naira = Math.round((event.data?.amount ?? 0) / 100);
  const note = `Paid ₦${naira.toLocaleString("en-NG")} via Paystack · ref ${event.data?.reference ?? ""}`.trim();
  const updated = (await updateBooking(bookingId, { paid: true, paymentNote: note })) ?? { ...booking, paid: true, paymentNote: note };
  await notifyPaymentReceived(updated);

  return Response.json({ ok: true });
}
