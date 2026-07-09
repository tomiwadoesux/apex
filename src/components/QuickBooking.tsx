"use client";

// Quick Booking — a compact, resumable booking flow that pops up ON the landing
// page (no navigation, no step dots). Six quick taps:
//   1. Car        — the fleet with its per-hour Naira rate beside each, pick one.
//   2. Duration   — fixed 6 / 12 / 24 hour blocks.
//   3. When       — a horizontal scroll of dates from today, plus a pickup time.
//   4. Route      — pickup address (+ optional popular landmark) and drop-off.
//   5. Contact    — name + phone.
//   6. Payment    — ApexRide's bank details (copyable), receipt upload + a note.
// Success shows the same downloadable ride-pass card as the full form.
//
// The component stays MOUNTED on the landing page and only hides its overlay,
// so a guest who closes it mid-way (or scrolls anywhere on the page) resumes
// exactly where they stopped when they reopen it. Only a reload starts over.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { CARS, type Variant } from "@/components/fleet/data";
import { DEFAULT_CONFIG, type SiteConfig } from "@/lib/siteConfigDefaults";
import { RidePass, type RideBooking } from "@/components/RideCard";
import { ratePerHour, naira } from "@/lib/pricing";
import PaymentSection, { EMPTY_PAYMENT, type PaymentDetails } from "@/components/PaymentSection";
import type { Booking } from "@/lib/bookings";

const BLUE = "#00209C";
const ACCENT = "#2A4FD0";

/* ── options ────────────────────────────────────────────────────────────────── */

// The short car list ("don't show all — just 4"), expandable to the full roster.
const AVAILABLE_CARS: Variant[] = CARS.filter((c) => c.image);
const SHORT_LIST = 4;
const DAYS_AHEAD = 60; // how far out the horizontal date strip runs

/* ── helpers ────────────────────────────────────────────────────────────────── */

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// "18:30" → "6:30 PM" for the summary line.
function formatClock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// "2026-06-28" → "Sat, 28 Jun 2026" for the ride-pass card (same as the form).
function formatCardDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function bookingToRide(b: Booking): RideBooking {
  return {
    service: b.service,
    pickup: b.pickup,
    dropoff: b.dropoff,
    duration: b.duration,
    date: b.date,
    time: b.time,
    bookingRef: b.id,
    car: { name: b.car.name, klass: b.car.klass, side: { light: b.car.image ?? "", dark: b.car.image ?? "" } },
    passengerName: b.passenger.name || undefined,
    phone: b.passenger.phone || undefined,
  };
}

const validPhone = (phone: string) => /^(?:\+234|234|0)[789]\d{9}$/.test(phone.replace(/[^\d+]/g, ""));

const STEP_TITLES = [
  "Choose your car",
  "For how long?",
  "When do you need it?",
  "Pickup & drop-off",
  "Who is riding?",
  "Payment",
];

/* ── component ──────────────────────────────────────────────────────────────── */

export default function QuickBooking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  // Admin-edited options (durations, car list) — defaults until /api/config loads.
  const [cfg, setCfg] = useState<SiteConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((c) => setCfg((prev) => ({ ...prev, ...c }))).catch(() => {});
  }, []);
  const durations = cfg.durations.filter((d) => d.id !== "multiday").map((d) => ({ id: d.id, badge: "Fixed Duration", name: d.name, hours: d.hours ?? 6, desc: d.desc }));
  const availableCars: Variant[] = [
    ...AVAILABLE_CARS.filter((c) => !cfg.hiddenCars.includes(c.name)),
    ...cfg.extraCars.map((c) => ({ id: c.id, label: c.year, name: c.name, year: Number(c.year) || 2025, type: c.type || "Fleet selection", specs: c.specs, image: c.image })),
  ];

  const [car, setCar] = useState<Variant | null>(null);
  const [showAllCars, setShowAllCars] = useState(false);
  const [duration, setDuration] = useState<(typeof durations)[number] | null>(null);
  const [date, setDate] = useState<string>(""); // ISO yyyy-mm-dd
  const [time, setTime] = useState<string>(""); // HH:MM (24h)
  const [pickup, setPickup] = useState("");
  const [landmark, setLandmark] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [payment, setPayment] = useState<PaymentDetails>(EMPTY_PAYMENT);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const passRef = useRef<HTMLDivElement>(null);

  // The horizontal date strip: today + the next DAYS_AHEAD days.
  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, []);

  // Esc closes (progress is kept); lock page scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const submit = async () => {
    if (!car || !duration || !date || !time || submitting) return;
    const bookingPayload = {
      passenger: { name: name.trim(), phone: phone.trim(), email: "" },
      car: { name: car.name, klass: car.type, image: car.image ? car.image.replace(/^\/images\//, "") : null },
      service: "Chauffeur service",
      pickup: landmark.trim() ? `${pickup.trim()} (near ${landmark.trim()})` : pickup.trim(),
      dropoff: dropoff.trim() || null,
      duration: `${duration.hours} hours`,
      date: formatCardDate(date),
      time,
      light: true,
      paymentNote: payment.note.trim() || null,
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bookingPayload, receipt: payment.receipt, receiptName: payment.receiptName }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.booking) {
        setBooking(data.booking as Booking);
      } else {
        throw new Error("save failed");
      }
    } catch {
      // Offline / API down: still show the pass with a local reference.
      setBooking({ ...bookingPayload, id: "APX-" + Math.floor(100000 + Math.random() * 900000), createdAt: Date.now() });
    } finally {
      setSubmitting(false);
      setStep(6);
    }
  };

  // Render the card to a PNG, then share it (phones → Photos) or download it.
  const saveCard = async () => {
    const node = passRef.current?.querySelector("[data-ride-card]") as HTMLElement | null;
    if (!node || !booking || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true, style: { transform: "none" } }); // export the card FLAT, never with the live hover/motion tilt
      const fileName = `apexride-pass-${booking.id.replace(/[^a-z0-9]/gi, "")}.png`;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "ApexRide pass", text: `Booking ${booking.id}` });
          return;
        }
      } catch { /* sharing unavailable — fall through to a download */ }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch (err) {
      console.error("card export failed", err);
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    setStep(0);
    setCar(null);
    setShowAllCars(false);
    setDuration(null);
    setDate("");
    setTime("");
    setPickup("");
    setLandmark("");
    setDropoff("");
    setName("");
    setPhone("");
    setPhoneTouched(false);
    setPayment(EMPTY_PAYMENT);
    setBooking(null);
  };

  if (!open) return null;

  const phoneBad = phoneTouched && phone.trim() !== "" && !validPhone(phone);
  const contactReady = name.trim() !== "" && validPhone(phone);

  // Shared option-card chrome.
  const cardCls = (active: boolean) =>
    `w-full rounded-2xl border p-3.5 text-left transition-all duration-200 ${
      active
        ? "border-[#00209C] bg-[#00209C] text-white shadow-lg shadow-[#00209C]/20"
        : "border-neutral-900/10 bg-white/60 text-neutral-900 hover:border-[#00209C]/40 hover:bg-white"
    }`;
  const badgeCls = (active: boolean) =>
    `text-[9px] font-bold uppercase tracking-[0.22em] ${active ? "text-white/60" : "text-neutral-400"}`;
  const descCls = (active: boolean) => `mt-1 text-[11px] leading-relaxed ${active ? "text-white/65" : "text-neutral-500"}`;
  const inputCls =
    "w-full rounded-xl border border-neutral-900/10 bg-white/70 px-4 py-3 text-base outline-none sm:text-sm transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]";
  const continueBtn =
    "mt-1 h-11 rounded-full text-sm font-semibold tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:px-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick booking"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[86vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white/95 text-neutral-900 shadow-2xl backdrop-blur-xl sm:max-h-[82vh] sm:rounded-3xl"
      >
        {/* header */}
        <div className="flex shrink-0 items-start justify-between border-b border-neutral-100 px-5 py-4">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>Quick booking</div>
            <h2 className="mt-1 font-josefin text-xl font-light tracking-tight">
              {step <= 5 ? STEP_TITLES[step] : "You're booked!"}
            </h2>
            {step <= 5 && <div className="mt-0.5 text-[11px] text-neutral-400">Step {step + 1} of 6 — closing keeps your progress</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-900"
          >
            Close
          </button>
        </div>

        {/* body */}
        <div data-lenis-prevent className="accent-scrollbar flex min-h-0 flex-col gap-2 overflow-y-auto p-4">
          {/* 1 — car with per-hour price */}
          {step === 0 && (
            <>
              {(showAllCars ? availableCars : availableCars.slice(0, SHORT_LIST)).map((c) => {
                const active = car?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCar(c); setStep(1); }}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${active ? "border-[#00209C] bg-[#00209C]/[0.06]" : "border-neutral-900/10 bg-white/60 hover:border-[#00209C]/40 hover:bg-white"}`}
                  >
                    <span className="relative block h-10 w-18 shrink-0" style={{ width: "4.5rem" }}>
                      {c.image ? (
                        <Image src={c.image} alt="" fill sizes="72px" className="object-contain" />
                      ) : (
                        <span className="grid h-full w-full place-items-center text-sm text-neutral-300">—</span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${active ? "text-[#00209C]" : "text-neutral-900"}`}>{c.name}</span>
                      <span className="block truncate text-[11px] text-neutral-400">{c.year} · {c.type}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold tabular-nums" style={{ color: active ? BLUE : "#171717" }}>{naira(ratePerHour(c.id))}</span>
                      <span className="block text-[10px] font-medium uppercase tracking-wider text-neutral-400">per hour</span>
                    </span>
                  </button>
                );
              })}
              {availableCars.length > SHORT_LIST && (
                <button
                  type="button"
                  onClick={() => setShowAllCars((v) => !v)}
                  className="mt-1 text-[11px] font-semibold uppercase tracking-widest transition-colors"
                  style={{ color: ACCENT }}
                >
                  {showAllCars ? "Show fewer cars" : `Show all ${availableCars.length} cars`}
                </button>
              )}
            </>
          )}

          {/* 2 — duration */}
          {step === 1 && durations.map((d) => {
            const active = duration?.id === d.id;
            return (
              <button key={d.id} type="button" onClick={() => { setDuration(d); setStep(2); }} className={cardCls(active)}>
                <div className={badgeCls(active)}>{d.badge}</div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold tracking-tight">{d.name}</span>
                  {car && (
                    <span className={`text-[11px] font-semibold tabular-nums ${active ? "text-white/70" : "text-neutral-500"}`}>
                      ≈ {naira(ratePerHour(car.id) * d.hours)}
                    </span>
                  )}
                </div>
                <div className={descCls(active)}>{d.desc}</div>
              </button>
            );
          })}

          {/* 3 — when: horizontal date scroll + time */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-500">Pick a date</label>
                <div data-lenis-prevent className="accent-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                  {days.map((d, i) => {
                    const iso = toIsoDate(d);
                    const active = date === iso;
                    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short" });
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setDate(iso)}
                        className={`flex shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition-all ${
                          active
                            ? "border-[#00209C] bg-[#00209C] text-white shadow-lg shadow-[#00209C]/20"
                            : "border-neutral-900/10 bg-white/60 text-neutral-900 hover:border-[#00209C]/40 hover:bg-white"
                        }`}
                        style={{ minWidth: "4rem" }}
                      >
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-white/70" : "text-neutral-400"}`}>{label}</span>
                        <span className="text-lg font-semibold leading-none tabular-nums">{d.getDate()}</span>
                        <span className={`text-[10px] font-medium uppercase ${active ? "text-white/70" : "text-neutral-400"}`}>{d.toLocaleDateString("en-GB", { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Pickup time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                type="button"
                disabled={!date || !time}
                onClick={() => setStep(3)}
                className={continueBtn}
                style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
              >
                Continue
              </button>
            </div>
          )}

          {/* 4 — pickup & drop-off */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Pickup address *</label>
                <input
                  type="text"
                  value={pickup}
                  onChange={(e) => setPickup(e.target.value)}
                  placeholder="Where should we pick you up?"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Popular landmark <span className="font-normal text-neutral-400">(optional)</span></label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. near Eko Hotel, Ikeja City Mall"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Drop-off address *</label>
                <input
                  type="text"
                  value={dropoff}
                  onChange={(e) => setDropoff(e.target.value)}
                  placeholder="Where are you headed?"
                  className={inputCls}
                  onKeyDown={(e) => { if (e.key === "Enter" && pickup.trim() && dropoff.trim()) setStep(4); }}
                />
              </div>
              <button
                type="button"
                disabled={!pickup.trim() || !dropoff.trim()}
                onClick={() => setStep(4)}
                className={continueBtn}
                style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
              >
                Continue
              </button>
            </div>
          )}

          {/* 5 — contact */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Full name *</label>
                <input
                  type="text"
                  value={name}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Phone number *</label>
                <input
                  type="tel"
                  value={phone}
                  autoComplete="tel"
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder="08012345678"
                  className={inputCls}
                />
                {phoneBad && (
                  <p className="mt-1.5 text-[10px] font-medium text-red-600">
                    Invalid Nigerian phone number. Must be 11 digits starting with 0 (e.g. 08012345678).
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!contactReady}
                onClick={() => setStep(5)}
                className={continueBtn}
                style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
              >
                Continue to payment
              </button>
            </div>
          )}

          {/* 6 — payment */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <PaymentSection value={payment} onChange={setPayment} isLight />
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className={continueBtn}
                style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
              >
                {submitting ? "Booking…" : "Book my ride"}
              </button>
            </div>
          )}

          {/* 7 — confirmation (the card itself is rendered off-screen only so it
              can still be exported to an image on demand) */}
          {step === 6 && booking && (
            <div className="flex flex-col items-center gap-4 py-3 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full" style={{ background: BLUE + "12", color: BLUE }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <div>
                <h3 className="font-josefin text-lg font-medium tracking-tight">Booking confirmed</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">
                  Your work order <span className="font-semibold text-neutral-900">{booking.id}</span> is in.
                  {booking.passenger.phone ? ` We'll call ${booking.passenger.phone} shortly to confirm.` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void saveCard()}
                  disabled={saving}
                  className="rounded-full px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-all disabled:opacity-60"
                  style={{ background: BLUE }}
                >
                  {saving ? "Preparing…" : "Download ride pass"}
                </button>
                <a
                  href={`/check-booking?ref=${encodeURIComponent(booking.id)}`}
                  className="rounded-full border border-neutral-300 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-neutral-600 transition-colors hover:bg-neutral-100"
                >
                  Track booking
                </a>
              </div>

              <p className="max-w-xs text-[11px] leading-relaxed text-neutral-400">
                Keep your work order ID. You can view or download this booking anytime at{" "}
                <a href="/check-booking" className="font-semibold underline" style={{ color: BLUE }}>apex.ayotomcs.me/check-booking</a>.
                A copy has been sent to the team.
              </p>

              <button
                type="button"
                onClick={startOver}
                className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-900"
              >
                Book another
              </button>

              {/* off-screen card kept mounted purely so the download can rasterise it */}
              <div ref={passRef} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 opacity-0">
                <RidePass booking={bookingToRide(booking)} light />
              </div>
            </div>
          )}
        </div>

        {/* footer — back / summary line (no step dots) */}
        {step >= 1 && step <= 5 && (
          <div className="flex shrink-0 items-center justify-between border-t border-neutral-100 px-5 py-3">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-neutral-900"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back
            </button>
            <span className="max-w-[60%] truncate text-right text-[10px] text-neutral-400">
              {[car?.name, duration?.name, date ? `${formatCardDate(date).replace(/,.*/, "")}${time ? ` · ${formatClock12(time)}` : ""}` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
