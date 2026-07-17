"use client";

// Quick Booking — a compact, resumable booking flow that pops up ON the landing
// page (no navigation, no step dots). Steps:
//   1. Car       — the fleet, each showing its Airport + 12-hour price.
//   2. Service   — Airport Pickup or 12 Hours (price set from the car).
//   3. When      — a horizontal scroll of dates from today, plus a pickup time.
//   4. Location  — airport terminal (or a typed one) for airport pickups; a
//                  pickup address for 12-hour bookings.
//   5. Contact   — name, phone, optional email.
//   6. Payment   — Paystack. Persists (until paid) even across a tab close.
//
// The component stays MOUNTED on the landing page and only hides its overlay, so
// a guest who closes it mid-way resumes where they stopped. Only a reload resets.

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toPng } from "html-to-image";
import { CARS, type Variant } from "@/components/fleet/data";
import { DEFAULT_CONFIG, type SiteConfig } from "@/lib/siteConfigDefaults";
import { RidePass, type RideBooking } from "@/components/RideCard";
import { naira } from "@/lib/pricing";
import PaystackPay from "@/components/PaystackPay";
import { loadPending, savePending, clearPending } from "@/lib/pendingPayment";
import type { Booking } from "@/lib/bookings";

const BLUE = "#00209C";
const DAYS_AHEAD = 60;

// Lagos airport terminals for an airport pickup, plus "Other" for a typed one.
const TERMINALS = ["MMIA — International", "MMA2 — Domestic", "MMA1 / GAT — Domestic", "Other"];

type Service = "airport" | "12h";

/* ── helpers ────────────────────────────────────────────────────────────────── */

const toIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function formatClock12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

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

const STEP_TITLES = ["Choose your car", "Choose a service", "When do you need it?", "Where from?", "Who is riding?", "Payment"];

/* ── component ──────────────────────────────────────────────────────────────── */

export default function QuickBooking({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<SiteConfig>(DEFAULT_CONFIG);
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((c) => setCfg((prev) => ({ ...prev, ...c }))).catch(() => {});
  }, []);

  const allCars: Variant[] = [
    ...CARS,
    ...cfg.extraCars.map((c) => ({ id: c.id, label: c.year, name: c.name, year: Number(c.year) || 2025, type: c.type || "Fleet selection", specs: c.specs, image: c.image })),
  ];
  // Admin's chosen Quick Booking cars, in order (photo optional). Empty → every
  // photographed car.
  const availableCars: Variant[] = cfg.quickCars.length
    ? cfg.quickCars.map((id) => allCars.find((c) => c.id === id)).filter((c): c is Variant => Boolean(c))
    : allCars.filter((c) => c.image && !cfg.hiddenCars.includes(c.name));

  // Price for a car + service from the admin-editable Quick Booking rates.
  const priceFor = (carId: string, svc: Service): number => {
    const r = cfg.qbRates[carId];
    if (!r) return 0;
    return svc === "airport" ? r.airport : r.hours12;
  };

  const [car, setCar] = useState<Variant | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [terminal, setTerminal] = useState<string>("");
  const [terminalCustom, setTerminalCustom] = useState<string>("");
  const [pickup, setPickup] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const [resumed, setResumed] = useState(false);
  const passRef = useRef<HTMLDivElement>(null);

  // Restore a placed-but-unpaid booking (survives a tab/app close) → payment step.
  useEffect(() => {
    const p = loadPending();
    if (p) { setBooking(p.booking); setStep(5); setResumed(true); }
  }, []);

  const days = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, []);

  useEffect(() => {
    if (!open && !resumed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setResumed(false); onClose(); } };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, resumed, onClose]);

  const serviceLabel = service === "airport" ? "Airport Pickup" : service === "12h" ? "12 Hours" : "";
  const amount = car && service ? priceFor(car.id, service) : null;
  const terminalLabel = terminal === "Other" ? terminalCustom.trim() : terminal;

  const submit = async () => {
    if (!car || !service || !date || !time || submitting) return;
    const pickupText = service === "airport" ? terminalLabel : pickup.trim();
    const bookingPayload = {
      passenger: { name: name.trim(), phone: phone.trim(), email: email.trim() },
      car: { name: car.name, klass: car.type, image: car.image ? car.image.replace(/^\/images\//, "") : null },
      service: serviceLabel,
      pickup: pickupText,
      dropoff: null,
      duration: service === "12h" ? "12 hours" : null,
      date: formatCardDate(date),
      time,
      light: true,
      amount: amount ?? 0,
    };
    setSubmitting(true);
    let placed: Booking;
    try {
      const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bookingPayload) });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.booking) placed = data.booking as Booking;
      else throw new Error("save failed");
    } catch {
      placed = { ...bookingPayload, id: "APX-" + Math.floor(100000 + Math.random() * 900000), createdAt: Date.now() };
    }
    setBooking(placed);
    savePending({ booking: placed });
    setSubmitting(false);
    setStep(5);
  };

  const onPaid = () => { clearPending(); setStep(6); };

  const saveCard = async () => {
    const node = passRef.current?.querySelector("[data-ride-card]") as HTMLElement | null;
    if (!node || !booking || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, style: { transform: "none" } });
      const fileName = `apexride-pass-${booking.id.replace(/[^a-z0-9]/gi, "")}.png`;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
        if (nav.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: "ApexRide pass", text: `Booking ${booking.id}` }); return; }
      } catch { /* sharing unavailable, fall through to a download */ }
      const a = document.createElement("a");
      a.href = dataUrl; a.download = fileName; a.click();
    } catch (err) {
      console.error("card export failed", err);
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    setStep(0); setCar(null); setService(null); setDate(""); setTime("");
    setTerminal(""); setTerminalCustom(""); setPickup("");
    setName(""); setPhone(""); setPhoneTouched(false); setEmail("");
    setBooking(null); setResumed(false); clearPending();
  };
  const handleClose = () => { setResumed(false); onClose(); };
  const cancelBooking = () => { startOver(); onClose(); };

  if (!open && !resumed) return null;

  const phoneBad = phoneTouched && phone.trim() !== "" && !validPhone(phone);
  const contactReady = name.trim() !== "" && validPhone(phone);
  const locationReady = service === "airport"
    ? terminal !== "" && (terminal !== "Other" || terminalCustom.trim() !== "")
    : pickup.trim() !== "";

  const inputCls = "w-full rounded-xl border border-neutral-900/10 bg-white/70 px-4 py-3 text-base outline-none sm:text-sm transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]";
  const continueBtn = "mt-1 h-11 rounded-full text-sm font-semibold tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:px-6" onClick={handleClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick booking"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl sm:max-h-[84vh] sm:rounded-3xl"
      >
        {/* header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4" style={{ background: "linear-gradient(180deg,#f7f9ff,#ffffff)" }}>
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>Quick booking</div>
            <h2 className="mt-1 font-josefin text-xl font-light tracking-tight">{step <= 5 ? STEP_TITLES[step] : "You're booked!"}</h2>
            <div className="mt-1 flex items-center gap-2">
              {step <= 4 && <span className="text-[11px] text-neutral-400">Step {step + 1} of 5</span>}
              {step === 5 && <span className="text-[11px] text-neutral-400">Booking {booking?.id}</span>}
              {amount != null && step >= 1 && step <= 4 && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5" style={{ background: BLUE + "10" }}>
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: BLUE + "99" }}>{serviceLabel}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: BLUE }}>{naira(amount)}</span>
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={handleClose} className="mt-0.5 shrink-0 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-900">Close</button>
        </div>

        {/* body */}
        <div data-lenis-prevent className="accent-scrollbar flex min-h-0 flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-4">
          {/* 1 — car with both service prices */}
          {step === 0 && availableCars.map((c) => {
            const active = car?.id === c.id;
            const r = cfg.qbRates[c.id];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => { setCar(c); setStep(1); }}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-all ${active ? "border-[#00209C] bg-[#00209C]/[0.05] shadow-sm" : "border-neutral-900/10 bg-white hover:border-[#00209C]/40 hover:shadow-sm"}`}
              >
                <span className="relative block h-12 shrink-0 overflow-hidden rounded-lg" style={{ width: "5rem" }}>
                  {c.image ? (
                    <Image src={c.image} alt="" fill sizes="80px" className="object-contain" />
                  ) : (
                    <span className="grid h-full w-full place-items-center bg-neutral-100 text-neutral-300">
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M3 13h18v4a1 1 0 0 1-1 1h-1a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H4a1 1 0 0 1-1-1z" /><circle cx="7.5" cy="16.5" r="0.5" /><circle cx="16.5" cy="16.5" r="0.5" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-semibold ${active ? "text-[#00209C]" : "text-neutral-900"}`}>{c.name}</span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {(r?.airport ?? 0) > 0 && (
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">Airport <span className="tabular-nums" style={{ color: BLUE }}>{naira(r!.airport)}</span></span>
                    )}
                    <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-600">12hrs <span className="tabular-nums" style={{ color: BLUE }}>{naira(r?.hours12 ?? 0)}</span></span>
                  </span>
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? BLUE : "#cbd5e1"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            );
          })}

          {/* 2 — service */}
          {step === 1 && car && (
            <>
              {([
                ...(priceFor(car.id, "airport") > 0
                  ? [{ id: "airport" as Service, name: "Airport Pickup", desc: "We meet you at your terminal and drive you in.", price: priceFor(car.id, "airport") }]
                  : []),
                { id: "12h" as Service, name: "12 Hours", desc: "A chauffeur for a fixed 12-hour block, wherever you go.", price: priceFor(car.id, "12h") },
              ]).map((s) => {
                const active = service === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setService(s.id); setStep(2); }}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${active ? "border-[#00209C] bg-[#00209C] text-white shadow-lg shadow-[#00209C]/20" : "border-neutral-900/10 bg-white text-neutral-900 hover:border-[#00209C]/40 hover:shadow-sm"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-base font-semibold tracking-tight">{s.name}</span>
                      <span className="text-base font-bold tabular-nums">{naira(s.price)}</span>
                    </div>
                    <div className={`mt-1 text-[11px] leading-relaxed ${active ? "text-white/70" : "text-neutral-500"}`}>{s.desc}</div>
                  </button>
                );
              })}
            </>
          )}

          {/* 3 — when */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-neutral-500">Pick a date</label>
                <div data-lenis-prevent className="accent-scrollbar -mx-1 flex gap-2 overflow-x-auto overscroll-x-contain px-1 pb-2" style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}>
                  {days.map((d, i) => {
                    const iso = toIsoDate(d);
                    const active = date === iso;
                    const lbl = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short" });
                    return (
                      <button key={iso} type="button" onClick={() => setDate(iso)} style={{ minWidth: "4rem" }}
                        className={`flex shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition-all ${active ? "border-[#00209C] bg-[#00209C] text-white shadow-lg shadow-[#00209C]/20" : "border-neutral-900/10 bg-white text-neutral-900 hover:border-[#00209C]/40"}`}>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? "text-white/70" : "text-neutral-400"}`}>{lbl}</span>
                        <span className="text-lg font-semibold leading-none tabular-nums">{d.getDate()}</span>
                        <span className={`text-[10px] font-medium uppercase ${active ? "text-white/70" : "text-neutral-400"}`}>{d.toLocaleDateString("en-GB", { month: "short" })}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Pickup time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
              </div>
              <button type="button" disabled={!date || !time} onClick={() => setStep(3)} className={continueBtn} style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}>Continue</button>
            </div>
          )}

          {/* 4 — location: terminal (airport) OR pickup address (12h) */}
          {step === 3 && (
            <div className="flex flex-col gap-3">
              {service === "airport" ? (
                <>
                  <label className="block text-xs font-semibold tracking-wide text-neutral-500">Which terminal are we picking you up from?</label>
                  <div className="flex flex-col gap-2">
                    {TERMINALS.map((t) => {
                      const active = terminal === t;
                      return (
                        <button key={t} type="button" onClick={() => setTerminal(t)}
                          className={`flex items-center justify-between rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-all ${active ? "border-[#00209C] bg-[#00209C]/[0.06] text-[#00209C]" : "border-neutral-900/10 bg-white text-neutral-800 hover:border-[#00209C]/40"}`}>
                          {t === "Other" ? "Other (type it below)" : t}
                          {active && <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                        </button>
                      );
                    })}
                  </div>
                  {terminal === "Other" && (
                    <input type="text" value={terminalCustom} onChange={(e) => setTerminalCustom(e.target.value)} placeholder="Type the terminal or airport" className={inputCls} autoFocus />
                  )}
                </>
              ) : (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Pickup address *</label>
                  <input type="text" value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Where should we pick you up?" className={inputCls} onKeyDown={(e) => { if (e.key === "Enter" && pickup.trim()) setStep(4); }} />
                </div>
              )}
              <button type="button" disabled={!locationReady} onClick={() => setStep(4)} className={continueBtn} style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}>Continue</button>
            </div>
          )}

          {/* 5 — contact (+ optional email) */}
          {step === 4 && (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Full name *</label>
                <input type="text" value={name} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="John Doe" className={inputCls} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Phone number *</label>
                <div className="flex w-full items-center gap-2 rounded-xl border border-neutral-900/10 bg-white/70 px-3 transition-colors focus-within:border-[#00209C] focus-within:ring-1 focus-within:ring-[#00209C]">
                  <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-neutral-500"><span className="text-base leading-none">🇳🇬</span> +234</span>
                  <span className="h-5 w-px bg-neutral-900/10" />
                  <input type="tel" value={phone} autoComplete="tel" onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhoneTouched(true)} placeholder="0801 234 5678" className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-neutral-400 sm:text-sm" />
                </div>
                {phoneBad && <p className="mt-1.5 text-[10px] font-medium text-red-600">Invalid Nigerian phone number. Must be 11 digits starting with 0 (e.g. 08012345678).</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold tracking-wide text-neutral-500">Email <span className="font-normal text-neutral-400">(optional — for your receipt)</span></label>
                <input type="email" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className={inputCls} />
              </div>
              <button type="button" disabled={!contactReady || submitting} onClick={() => void submit()} className={continueBtn} style={{ background: BLUE, boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)" }}>
                {submitting ? "Placing your booking…" : `Continue to payment${amount != null ? ` · ${naira(amount)}` : ""}`}
              </button>
            </div>
          )}

          {/* 6 — payment */}
          {step === 5 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-[#00209C]/15 bg-[#00209C]/[0.04] px-4 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Work order</div>
                <div className="text-lg font-semibold tracking-tight" style={{ color: BLUE }}>{booking?.id}</div>
                <div className="mt-0.5 text-[11px] text-neutral-500">Your ride is reserved. Pay below to confirm it.</div>
              </div>
              {booking && (
                <PaystackPay bookingId={booking.id} email={booking.passenger.email} amountNaira={booking.amount ?? 0} isLight onPaid={onPaid} />
              )}
              <p className="text-center text-[10px] leading-relaxed text-neutral-400">Not ready to pay? You can close this. Your work order is saved and this step comes back next time until payment is done.</p>
              <div className="flex items-center justify-center gap-4 pt-1">
                <button type="button" onClick={startOver} className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 transition-colors hover:text-neutral-900">Book another ride</button>
                <span className="h-3 w-px bg-neutral-300" />
                <button type="button" onClick={cancelBooking} className="text-[11px] font-bold uppercase tracking-widest text-red-600 transition-colors hover:text-red-700">Cancel booking</button>
              </div>
            </div>
          )}

          {/* 7 — done */}
          {step === 6 && booking && (
            <div className="flex flex-col items-center gap-4 py-3 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full" style={{ background: BLUE + "12", color: BLUE }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <div>
                <h3 className="font-josefin text-lg font-medium tracking-tight">Payment received</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">Your work order is <span className="font-semibold text-neutral-900">{booking.id}</span>.</p>
                <p className="mx-auto mt-2 max-w-xs rounded-xl bg-[#00209C]/[0.06] px-3 py-2 text-[11px] leading-relaxed text-neutral-600">Your booking is <span className="font-semibold">confirmed</span>. We&apos;ll reach out{booking.passenger.phone ? ` on ${booking.passenger.phone}` : ""} shortly with your driver details.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button type="button" onClick={() => void saveCard()} disabled={saving} className="rounded-full px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-all disabled:opacity-60" style={{ background: BLUE }}>{saving ? "Preparing…" : "Download ride pass"}</button>
                <a href={`/check-booking?ref=${encodeURIComponent(booking.id)}`} className="rounded-full border border-neutral-300 px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest text-neutral-600 transition-colors hover:bg-neutral-100">Track booking</a>
              </div>
              <p className="max-w-xs text-[11px] leading-relaxed text-neutral-400">Keep your work order ID. You can view or download this booking anytime at <a href="/check-booking" className="font-semibold underline" style={{ color: BLUE }}>apexriderental.com/check-booking</a>.</p>
              <button type="button" onClick={startOver} className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-400 transition-colors hover:text-neutral-900">Book another</button>
              <div ref={passRef} aria-hidden className="pointer-events-none fixed -left-[9999px] top-0 opacity-0"><RidePass booking={bookingToRide(booking)} light /></div>
            </div>
          )}
        </div>

        {/* footer — back + summary (hidden once the booking is placed) */}
        {step >= 1 && step <= 4 && (
          <div className="flex shrink-0 items-center justify-between border-t border-neutral-100 px-5 py-3">
            <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-neutral-900">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
              Back
            </button>
            <span className="max-w-[60%] truncate text-right text-[10px] text-neutral-400">
              {[car?.name, serviceLabel || null, date ? `${formatCardDate(date).replace(/,.*/, "")}${time ? ` · ${formatClock12(time)}` : ""}` : null].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}

        {/* Lagos-only disclaimer, pinned at the bottom of the modal */}
        {step <= 4 && (
          <div className="flex shrink-0 items-center justify-center gap-1.5 border-t border-neutral-100 bg-neutral-50/70 px-5 py-2 text-center text-[10px] font-medium text-neutral-500">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
            Quick Booking is available within Lagos only.
          </div>
        )}
      </div>
    </div>
  );
}
