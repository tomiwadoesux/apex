"use client";

// The booking detail sheet — a Vaul drawer that slides up from the bottom
// (thumb-reach on mobile, still pleasant on desktop). Everything the team does
// to one booking lives here: verify payment, set status, assign a driver,
// internal notes, and one-tap call / WhatsApp.

import { Drawer } from "vaul";
import type { Booking } from "@/lib/bookings";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/siteConfigDefaults";
import { ACCENT, STATUS_COLORS, STATUS_TINTS, input, label, naira } from "../ui";

// WhatsApp "payment verified" message, pre-filled with the booking details.
const whatsappVerifyLink = (b: Booking) => {
  const digits = b.passenger.phone.replace(/\D/g, "").replace(/^0/, "234");
  const lines = [
    `Hi ${b.passenger.name || "there"}, your payment has been verified ✅`,
    "",
    "Your ApexRide booking is confirmed:",
    `• Work order: ${b.id}`,
    `• Car: ${b.car.name}${b.car.klass ? ` (${b.car.klass})` : ""}`,
    `• Date: ${b.date} at ${b.time}`,
    `• Pickup: ${b.pickup}`,
    ...(b.dropoff ? [`• Drop-off: ${b.dropoff}`] : []),
    ...(b.duration ? [`• Duration: ${b.duration}`] : []),
    "",
    "Thank you for choosing ApexRide.",
  ];
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
};

export default function BookingDrawer({
  booking,
  onClose,
  onPatch,
}: {
  booking: Booking | null;
  onClose: () => void;
  onPatch: (ref: string, patch: Partial<Pick<Booking, "status" | "driver" | "notes" | "paid">>) => void;
}) {
  const b = booking;
  const status = (b?.status ?? "new") as BookingStatus;

  return (
    <Drawer.Root open={!!b} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[94dvh] w-full max-w-2xl flex-col rounded-t-[1.75rem] bg-white outline-none">
          {b && (
            <>
              <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-neutral-200" />
              <div className="overflow-y-auto overscroll-contain px-5 pb-10 pt-4 sm:px-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Drawer.Title className="text-lg font-semibold tabular-nums">{b.id}</Drawer.Title>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    style={{ background: STATUS_TINTS[status], color: STATUS_COLORS[status] }}
                  >
                    {status}
                  </span>
                  {typeof b.amount === "number" && b.amount > 0 && (
                    <span className="ml-auto text-sm font-semibold tabular-nums text-neutral-900">{naira(b.amount)}</span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-neutral-500">
                  {b.passenger.name} · {b.car.name} · {b.date} at {b.time}
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="text-sm leading-relaxed text-neutral-600">
                    <div><span className="font-semibold text-neutral-900">Pickup:</span> {b.pickup}</div>
                    {b.dropoff && <div><span className="font-semibold text-neutral-900">Drop-off:</span> {b.dropoff}</div>}
                    {b.duration && <div><span className="font-semibold text-neutral-900">Duration:</span> {b.duration}</div>}
                    <div><span className="font-semibold text-neutral-900">Service:</span> {b.service}</div>
                    <div className="mt-2">
                      <span className="font-semibold text-neutral-900">Phone:</span>{" "}
                      <a href={`tel:${b.passenger.phone}`} style={{ color: ACCENT }}>{b.passenger.phone}</a>
                      {" · "}
                      <a
                        href={`https://wa.me/${b.passenger.phone.replace(/\D/g, "").replace(/^0/, "234")}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: ACCENT }}
                      >
                        WhatsApp
                      </a>
                    </div>
                    {b.passenger.email && <div><span className="font-semibold text-neutral-900">Email:</span> {b.passenger.email}</div>}
                    {b.paymentNote && (
                      <div className="mt-2 rounded-lg bg-neutral-50 p-2.5">
                        <span className="font-semibold text-neutral-900">Payment submitted:</span> {b.paymentNote}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Payment verification + one-tap WhatsApp confirmation */}
                    <div
                      className="rounded-xl border p-3 transition-colors duration-200"
                      style={{ borderColor: b.paid ? "#16a34a55" : "rgba(0,0,0,0.1)", background: b.paid ? "#16a34a10" : "transparent" }}
                    >
                      <label className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={!!b.paid}
                          onChange={(e) => onPatch(b.id, { paid: e.target.checked })}
                          className="h-4 w-4 accent-[#16a34a]"
                        />
                        <span className="text-sm font-semibold text-neutral-900">Payment verified (paid)</span>
                      </label>
                      {b.paid && (
                        <a
                          href={whatsappVerifyLink(b)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2.5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
                          style={{ background: "#25D366" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M17.5 14.4c-.3-.15-1.77-.87-2-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.95 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.9-.8-1.5-1.78-1.67-2.08-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.48-.5-.67-.5h-.57c-.2 0-.52.07-.8.37s-1.05 1.02-1.05 2.5 1.08 2.9 1.23 3.1c.15.2 2.12 3.24 5.14 4.54.72.3 1.28.5 1.71.63.72.23 1.37.2 1.89.12.58-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.17-1.42-.07-.13-.27-.2-.57-.35zM12 2a10 10 0 0 0-8.6 15.05L2 22l5.05-1.32A10 10 0 1 0 12 2z"/>
                          </svg>
                          Notify on WhatsApp: payment verified
                        </a>
                      )}
                    </div>

                    <div>
                      <label className={label}>Status</label>
                      <div className="flex flex-wrap gap-1.5">
                        {BOOKING_STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => onPatch(b.id, { status: s })}
                            className="rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.96]"
                            style={
                              status === s
                                ? { background: STATUS_COLORS[s], borderColor: STATUS_COLORS[s], color: "#fff" }
                                : { borderColor: "rgba(0,0,0,0.12)", color: "#525252" }
                            }
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className={label}>Driver</label>
                      <input
                        key={b.id}
                        defaultValue={b.driver ?? ""}
                        onBlur={(e) => e.target.value !== (b.driver ?? "") && onPatch(b.id, { driver: e.target.value })}
                        placeholder="e.g. Emeka, black Escalade"
                        className={input}
                      />
                    </div>
                    <div>
                      <label className={label}>Internal notes</label>
                      <textarea
                        key={b.id}
                        defaultValue={b.notes ?? ""}
                        onBlur={(e) => e.target.value !== (b.notes ?? "") && onPatch(b.id, { notes: e.target.value })}
                        rows={3}
                        className={`${input} resize-none`}
                        placeholder="Only the team sees this"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
