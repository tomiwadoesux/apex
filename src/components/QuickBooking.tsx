"use client";

// Quick Booking — a compact, resumable booking flow that pops up ON the landing
// page (no navigation, no step dots). Six quick taps:
//   1. Pickup time   — In 2 hours / In 5 hours / Tomorrow by 9AM, each showing
//                      the actual Nigerian (WAT) clock time it resolves to.
//   2. Trip type     — Custom / Interstate / Airport Transfer / Point-to-Point.
//   3. Duration      — fixed 6 / 12 / 24 hour blocks.
//   4. Pickup spot   — state chips (pre-picked from the visitor's IP when we can
//                      tell which Nigerian state they're in) + a free address.
//   5. Car           — "Our available cars": a short list of 4 (expandable).
//   6. Contact       — name + phone, then Book.
// Success shows the same downloadable ride-pass card as the full form.
//
// The component stays MOUNTED on the landing page and only hides its overlay,
// so a guest who closes it mid-way (or scrolls anywhere on the page) resumes
// exactly where they stopped when they reopen it. Only a reload starts over.

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { CARS, type Variant } from "@/components/fleet/data";
import { RidePass, type RideBooking } from "@/components/RideCard";
import type { Booking } from "@/lib/bookings";

const BLUE = "#00209C";
const ACCENT = "#2A4FD0";

/* ── options ────────────────────────────────────────────────────────────────── */

const TRIP_TYPES = [
  { id: "custom", badge: "Flexible", name: "Custom", desc: "Bespoke itinerary — tell us exactly what you need." },
  { id: "interstate", badge: "Trip Type", name: "Interstate", desc: "Long-distance executive transit between states." },
  { id: "airport", badge: "Trip Type", name: "Airport Transfer", desc: "Flat-rate transfer to or from airport terminals." },
  { id: "point", badge: "Trip Type", name: "Point-to-Point", desc: "Direct executive transit between custom coordinates." },
] as const;

const DURATIONS = [
  { id: "6h", badge: "Fixed Duration", name: "6 Hours", hours: 6, desc: "Half-day chauffeur, billed as a fixed 6-hour block." },
  { id: "12h", badge: "Fixed Duration", name: "12 Hours", hours: 12, desc: "Full-day chauffeur across a fixed 12-hour block." },
  { id: "24h", badge: "Fixed Duration", name: "24 Hours", hours: 24, desc: "Round-the-clock chauffeur on call for a full day." },
] as const;

const STATES = ["Lagos", "Abuja"];

// The short car list ("don't show all — just 4"), expandable to the full roster.
const AVAILABLE_CARS: Variant[] = CARS.filter((c) => c.image);
const SHORT_LIST = 4;

/* ── helpers ────────────────────────────────────────────────────────────────── */

// Nigerian (WAT) clock time for a Date — what the guest will actually be booked for.
const watTime = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit" }).format(d);

const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000);
const tomorrowAt9 = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
};

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const toClock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

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
  "When do you need the ride?",
  "What kind of trip?",
  "For how long?",
  "Where do we pick you up?",
  "Our available cars",
  "Who is riding?",
];

/* ── component ──────────────────────────────────────────────────────────────── */

export default function QuickBooking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [pickupWhen, setPickupWhen] = useState<{ label: string; date: Date } | null>(null);
  const [tripType, setTripType] = useState<(typeof TRIP_TYPES)[number] | null>(null);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number] | null>(null);
  const [state, setState] = useState<string>("Lagos");
  const [stateDetected, setStateDetected] = useState(false); // true once the IP lookup filled it in
  const [address, setAddress] = useState("");
  const [car, setCar] = useState<Variant | null>(null);
  const [showAllCars, setShowAllCars] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [cardZoom, setCardZoom] = useState(1);
  const passRef = useRef<HTMLDivElement>(null);

  // Shrink the ride-pass card just enough that the WHOLE pass (plus its buttons)
  // fits inside the modal with no scrolling. The card is a fixed 5:7.5 stage
  // min(460px, 88vw) wide, so its natural height is fully predictable.
  useEffect(() => {
    if (step !== 6) return;
    const fit = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cardW = Math.min(460, vw * 0.88, 416); // 416 = modal max-w minus padding
      const ratio = vw >= 640 ? 1.5 : 2; // 5:7.5 on desktop, phone-length 9:18 on mobile
      const naturalH = cardW * ratio + 48; // aspect + the card's own py-6
      const modalMaxH = vh * (vw >= 640 ? 0.82 : 0.86);
      const avail = modalMaxH - 96 - 150; // header + confirm line + buttons
      setCardZoom(Math.max(0.5, Math.min(1, avail / naturalH)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [step]);

  // Best-effort: pre-pick the guest's Nigerian state from their IP. Silent on
  // any failure — Lagos stays the default and the chips remain one tap away.
  useEffect(() => {
    const controller = new AbortController();
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((r) => r.json())
      .then((d: { country_code?: string; region?: string }) => {
        if (d?.country_code !== "NG" || !d.region) return;
        const region = /abuja|federal capital/i.test(d.region) ? "Abuja" : d.region;
        setState(region);
        setStateDetected(true);
      })
      .catch(() => { /* offline / blocked / non-NG — keep the default */ });
    return () => controller.abort();
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

  const timeOptions = [
    { label: "In 2 hours", date: hoursFromNow(2) },
    { label: "In 5 hours", date: hoursFromNow(5) },
    { label: "Tomorrow by 9AM", date: tomorrowAt9() },
  ];

  const submit = async () => {
    if (!pickupWhen || !tripType || !duration || !car || submitting) return;
    const payload = {
      passenger: { name: name.trim(), phone: phone.trim(), email: "" },
      car: { name: car.name, klass: car.type, image: car.image!.replace(/^\/images\//, "") },
      service: tripType.name,
      pickup: address.trim() ? `${address.trim()}, ${state}` : state,
      dropoff: null,
      duration: `${duration.hours} hours`,
      date: formatCardDate(toIsoDate(pickupWhen.date)),
      time: toClock(pickupWhen.date),
      light: true,
    };
    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.booking) {
        setBooking(data.booking as Booking);
      } else {
        throw new Error("save failed");
      }
    } catch {
      // Offline / API down: still show the pass with a local reference.
      setBooking({ ...payload, id: "APX-" + Math.floor(100000 + Math.random() * 900000), createdAt: Date.now() });
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
    setPickupWhen(null);
    setTripType(null);
    setDuration(null);
    setAddress("");
    setCar(null);
    setShowAllCars(false);
    setName("");
    setPhone("");
    setPhoneTouched(false);
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
          {/* 1 — pickup time */}
          {step === 0 && timeOptions.map((o) => {
            const active = pickupWhen?.label === o.label;
            return (
              <button key={o.label} type="button" onClick={() => { setPickupWhen(o); setStep(1); }} className={cardCls(active)}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold tracking-tight">{o.label}</span>
                  <span className={`text-[10px] font-medium tabular-nums ${active ? "text-white/60" : "text-neutral-400"}`}>
                    {watTime(o.date)} WAT
                  </span>
                </div>
                <div className={descCls(active)}>
                  Pickup at {watTime(o.date)} Nigerian time{o.label.startsWith("Tomorrow") ? " tomorrow" : " today"}.
                </div>
              </button>
            );
          })}

          {/* 2 — trip type */}
          {step === 1 && TRIP_TYPES.map((t) => {
            const active = tripType?.id === t.id;
            return (
              <button key={t.id} type="button" onClick={() => { setTripType(t); setStep(2); }} className={cardCls(active)}>
                <div className={badgeCls(active)}>{t.badge}</div>
                <div className="mt-0.5 text-sm font-semibold tracking-tight">{t.name}</div>
                <div className={descCls(active)}>{t.desc}</div>
              </button>
            );
          })}

          {/* 3 — duration */}
          {step === 2 && DURATIONS.map((d) => {
            const active = duration?.id === d.id;
            return (
              <button key={d.id} type="button" onClick={() => { setDuration(d); setStep(3); }} className={cardCls(active)}>
                <div className={badgeCls(active)}>{d.badge}</div>
                <div className="mt-0.5 text-sm font-semibold tracking-tight">{d.name}</div>
                <div className={descCls(active)}>{d.desc}</div>
              </button>
            );
          })}

          {/* 4 — pickup location */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-semibold tracking-wide text-neutral-500">State</label>
                  {stateDetected && (
                    <span className="text-[10px] font-medium" style={{ color: ACCENT }}>Detected from your location</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...new Set([...STATES, state])].map((s) => {
                    const active = state === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => { setState(s); setStateDetected(false); }}
                        className="rounded-full border px-3.5 py-1.5 text-[11px] font-semibold tracking-wide transition-colors"
                        style={{
                          borderColor: active ? BLUE : "rgba(0,0,0,0.12)",
                          backgroundColor: active ? BLUE : "transparent",
                          color: active ? "#fff" : "#525252",
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">
                  {tripType?.id === "airport" ? "Airport / terminal or address *" : "Pickup address *"}
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Location must be accurate"
                  className="w-full rounded-xl border border-neutral-900/10 bg-white/70 px-4 py-3 text-base outline-none sm:text-sm transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]"
                  onKeyDown={(e) => { if (e.key === "Enter" && address.trim()) setStep(4); }}
                />
              </div>
              <button
                type="button"
                disabled={!address.trim()}
                onClick={() => setStep(4)}
                className="mt-1 h-11 rounded-full text-sm font-semibold tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
              >
                Continue
              </button>
            </div>
          )}

          {/* 5 — car */}
          {step === 4 && (
            <>
              {(showAllCars ? AVAILABLE_CARS : AVAILABLE_CARS.slice(0, SHORT_LIST)).map((c) => {
                const active = car?.id === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { setCar(c); setStep(5); }}
                    className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${active ? "bg-[#00209C]/[0.07]" : "hover:bg-neutral-100"}`}
                  >
                    <span className="relative block h-9 w-16 shrink-0">
                      <Image src={c.image!} alt="" fill sizes="64px" className="object-contain" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${active ? "text-[#00209C]" : "text-neutral-900"}`}>{c.name}</span>
                      <span className="block truncate text-[11px] text-neutral-400">{c.year} · {c.type}</span>
                    </span>
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setShowAllCars((v) => !v)}
                className="mt-1 text-[11px] font-semibold uppercase tracking-widest transition-colors"
                style={{ color: ACCENT }}
              >
                {showAllCars ? "Show fewer cars" : `Show all ${AVAILABLE_CARS.length} cars`}
              </button>
            </>
          )}

          {/* 6 — contact */}
          {step === 5 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Full name *</label>
                <input
                  type="text"
                  value={name}
                  autoComplete="name"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-xl border border-neutral-900/10 bg-white/70 px-4 py-3 text-base outline-none sm:text-sm transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]"
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
                  className="w-full rounded-xl border border-neutral-900/10 bg-white/70 px-4 py-3 text-base outline-none sm:text-sm transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]"
                />
                {phoneBad && (
                  <p className="mt-1.5 text-[10px] font-medium text-red-600">
                    Invalid Nigerian phone number. Must be 11 digits starting with 0 (e.g. 08012345678).
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!contactReady || submitting}
                onClick={() => void submit()}
                className="mt-1 h-11 rounded-full text-sm font-semibold tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}
              >
                {submitting ? "Booking…" : "Book my ride"}
              </button>
            </div>
          )}

          {/* 7 — confirmation: the downloadable ride-pass card */}
          {step === 6 && booking && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-xs leading-relaxed text-neutral-500">
                Booking <span className="font-semibold text-neutral-900">{booking.id}</span> confirmed —
                save your ride pass below.
              </p>
              <div ref={passRef} className="flex w-full justify-center">
                {/* `zoom` scales layout too (unlike transform), so the shrunken card
                    leaves no dead space and the buttons stay right below it. */}
                <div style={{ zoom: cardZoom }}>
                  <RidePass booking={bookingToRide(booking)} light />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void saveCard()}
                  disabled={saving}
                  className="rounded-full px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-all disabled:opacity-60"
                  style={{ background: BLUE }}
                >
                  {saving ? "Preparing…" : "Save card to photos"}
                </button>
                <button
                  type="button"
                  onClick={startOver}
                  className="rounded-full border border-neutral-300 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-neutral-600 transition-colors hover:bg-neutral-100"
                >
                  Book another
                </button>
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
              {[pickupWhen?.label, tripType?.name, duration?.name, car?.name].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
