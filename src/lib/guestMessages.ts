// Ready-made customer messages the team sends from a Telegram alert: payment
// details, booking confirmed, booking cancelled. Plain text for WhatsApp (opened
// as a wa.me link with the message pre-typed), plus the signed links to the
// /team/<ref> page that sends the same message as a branded email.
// Server-only (signing uses the admin secret).

import type { Booking } from "./bookings";
import type { PaymentInfo } from "./siteConfigDefaults";
import { naira } from "./pricing";
import { signAction, type TeamAction } from "./adminAuth";

export const CONTACT_PHONE = "0904 338 0193";
export const CONTACT_EMAIL = "apexrental08@gmail.com";
export const SITE_URL = process.env.SITE_URL || "https://apexriderental.com";

// The guest's number in wa.me form (234…), or "" when it isn't usable.
export function waDigits(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "").replace(/^0/, "234");
  return digits.length >= 10 ? digits : "";
}

export function waLink(phone: string, text?: string): string {
  const digits = waDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

const hello = (b: Booking) => `Hello${b.passenger.name ? ` ${b.passenger.name.split(" ")[0]}` : ""},`;
const signOff = `ApexRide\n📞 ${CONTACT_PHONE}\n✉️ ${CONTACT_EMAIL}`;
const when = (b: Booking) => `${b.date} at ${b.time}`;

export function paymentDetailsText(b: Booking, bank: PaymentInfo, amount?: number | null): string {
  const fare = amount && amount > 0 ? naira(amount) : "₦____";
  return [
    `${hello(b)} thank you for booking with ApexRide (ref ${b.id}).`,
    "",
    `To confirm your ${b.car.name} on ${when(b)}, please transfer ${fare} to:`,
    `Bank: ${bank.bankName}`,
    `Account number: ${bank.accountNumber}`,
    `Account name: ${bank.accountName}`,
    "",
    "Then reply here with your receipt and we'll confirm your ride.",
    "",
    signOff,
  ].join("\n");
}

export function confirmedText(b: Booking): string {
  return [
    `${hello(b)} your ApexRide booking ${b.id} is confirmed ✅`,
    "",
    `Car: ${b.car.name}`,
    `Pickup: ${b.pickup}`,
    `When: ${when(b)}`,
    "",
    "Your chauffeur's details will follow before pickup. Thank you for riding with us.",
    "",
    signOff,
  ].join("\n");
}

export function cancelledText(b: Booking, reason?: string | null): string {
  return [
    `${hello(b)} your ApexRide booking ${b.id} for ${when(b)} has been cancelled.`,
    ...(reason ? ["", `Reason: ${reason}`] : []),
    "",
    "If this is a mistake or you'd like to rebook, reply here or call us.",
    "",
    signOff,
  ].join("\n");
}

// https link to the /team page that emails the guest (Telegram buttons can't open mailto:).
export function teamActionUrl(b: Booking, action: TeamAction): string {
  const q = new URLSearchParams({ do: action, sig: signAction(b.id, action) });
  return `${SITE_URL}/team/${encodeURIComponent(b.id)}?${q}`;
}
