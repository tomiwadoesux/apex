// POST /api/team-action — the Send button on /team/<ref> (opened from a Telegram
// alert). Checks the signed link again, emails the guest from the no-reply
// address, updates the booking, then sends the team back to the page.

import { verifyAction } from "@/lib/adminAuth";
import { getBooking, updateBooking } from "@/lib/bookings";
import { emailBookingCancelled, emailBookingConfirmed, emailPaymentDetails } from "@/lib/notify";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const get = (k: string) => String(form?.get(k) ?? "").trim();
  const ref = get("ref").slice(0, 40);
  const action = get("do");
  const sig = get("sig");

  const back = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ do: action, sig, ...extra });
    return Response.redirect(new URL(`/team/${encodeURIComponent(ref)}?${q}`, request.url), 303);
  };

  if (!verifyAction(ref, action, sig)) return Response.json({ error: "Link not valid" }, { status: 403 });
  const booking = await getBooking(ref);
  if (!booking) return back({ error: "Booking not found." });

  try {
    if (action === "pay") {
      const amount = Math.round(Number(get("amount").replace(/[^\d.]/g, "")));
      if (!(amount > 0)) return back({ error: "Enter the amount to pay." });
      await emailPaymentDetails(booking, amount);
      await updateBooking(ref, { amount });
    } else if (action === "confirm") {
      await emailBookingConfirmed(booking);
      await updateBooking(ref, { status: "confirmed", paid: true });
    } else {
      const reason = get("reason").slice(0, 300);
      await emailBookingCancelled(booking, reason || null);
      const note = `Cancelled${reason ? `: ${reason}` : ""} (emailed guest ${new Date().toISOString().slice(0, 10)})`;
      await updateBooking(ref, { status: "cancelled", notes: booking.notes ? `${booking.notes}\n${note}` : note });
    }
  } catch (err) {
    console.error("[team-action] failed:", err);
    return back({ error: (err instanceof Error ? err.message : String(err)).slice(0, 300) });
  }
  return back({ sent: "1" });
}
