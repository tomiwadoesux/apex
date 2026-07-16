"use client";

// /admin — the team's panel. Password login (ADMIN_PASSWORD env var), then two
// tabs: BOOKINGS (status / driver / internal notes per booking) and OPTIONS
// (everything on the booking form that has an option: popular pickup spots,
// duration + trip-type tiers, quick-request chips, and the car list — add cars
// or hide built-ins; images are picked from existing photos, never uploaded).

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { CARS } from "@/components/fleet/data";
import { BOOKING_STATUSES, type BookingStatus, type SiteConfig } from "@/lib/siteConfigDefaults";
import type { Booking } from "@/lib/bookings";

const BLUE = "#00209C";
const ACCENT = "#2A4FD0";
const STATUS_COLORS: Record<BookingStatus, string> = {
  new: "#b45309",
  confirmed: "#1d4ed8",
  assigned: "#7c3aed",
  completed: "#15803d",
  cancelled: "#b91c1c",
};

const input =
  "w-full rounded-xl border border-neutral-900/10 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]";
const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";
const card = "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm";
const btn =
  "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-40";

// The photo choices for added cars: the EXISTING car images already in the repo.
const IMAGE_CHOICES = [...new Set(CARS.filter((c) => c.image).map((c) => c.image!))];

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<"bookings" | "options">("bookings");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [notifyStatus, setNotifyStatus] = useState<{ resend: boolean; companyEmail: string | null; ntfyTopic: string | null; supabase: boolean } | null>(null);
  const [testResults, setTestResults] = useState<{ channel: string; ok: boolean; detail: string }[] | null>(null);
  const [testing, setTesting] = useState(false);

  const loadAll = useCallback(async () => {
    const [b, c, n] = await Promise.all([
      fetch("/api/admin/bookings"),
      fetch("/api/admin/config"),
      fetch("/api/admin/notify-status"),
    ]);
    if (b.status === 401 || c.status === 401) {
      setAuthed(false);
      return;
    }
    setBookings((await b.json()).bookings ?? []);
    setConfig(await c.json());
    if (n.ok) setNotifyStatus(await n.json());
    setAuthed(true);
  }, []);

  const runNotifyTest = async () => {
    setTesting(true);
    setTestResults(null);
    const res = await fetch("/api/admin/notify-status", { method: "POST" });
    if (res.ok) setTestResults((await res.json()).results ?? []);
    setTesting(false);
  };

  useEffect(() => {
    // deferred a tick so the data fetch never sets state inside the effect body
    const t = setTimeout(() => void loadAll(), 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  const login = async () => {
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setPassword("");
      void loadAll();
    } else {
      setLoginError((await res.json().catch(() => null))?.error ?? "Login failed.");
    }
  };

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

  const patchBooking = async (ref: string, patch: Partial<Pick<Booking, "status" | "driver" | "notes" | "paid">>) => {
    // optimistic — the row updates immediately, the server confirms
    setBookings((all) => all.map((b) => (b.id === ref ? { ...b, ...patch } : b)));
    await fetch(`/api/admin/bookings/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const res = await fetch("/api/admin/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    if (res.ok) {
      setConfig(await res.json());
      setSavedAt(Date.now());
    }
    setSaving(false);
  };

  const set = <K extends keyof SiteConfig>(key: K, value: SiteConfig[K]) =>
    setConfig((c) => (c ? { ...c, [key]: value } : c));

  /* ── login screen ── */
  if (authed === false) {
    return (
      <main
        className="grid min-h-dvh place-items-center px-6 py-10 text-neutral-900"
        style={{ background: "radial-gradient(120% 100% at 50% 0%, #ffffff 0%, #eef2fb 45%, #dbe3f4 100%)" }}
      >
        <div className="w-full max-w-sm rounded-[2rem] border border-white/70 bg-white/80 p-7 shadow-[0_30px_80px_-30px_rgba(0,32,156,0.35)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl" style={{ background: BLUE + "12" }}>
              <Logo size={30} color="#0b0d12" accent={ACCENT} />
            </span>
            <h1 className="mt-4 font-josefin text-2xl font-light tracking-tight">
              Apex<span style={{ color: ACCENT }}>Ride</span> Admin
            </h1>
            <p className="mt-1 text-xs text-neutral-500">Sign in to manage bookings, prices &amp; options.</p>
          </div>

          <form
            className="mt-6 flex flex-col gap-3"
            onSubmit={(e) => { e.preventDefault(); void login(); }}
          >
            <div>
              <label className={label} htmlFor="admin-username">Username</label>
              <input
                id="admin-username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={input}
                placeholder="admin"
              />
            </div>

            <div>
              <label className={label} htmlFor="admin-password">Password</label>
              <div className="relative">
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} pr-11`}
                  placeholder="Your admin password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-11 place-items-center text-neutral-400 transition-colors hover:text-neutral-700"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {loginError && <p className="text-xs font-medium text-red-600">{loginError}</p>}

            <button type="submit" className={`${btn} mt-1 w-full`} style={{ background: BLUE }}>
              Sign in
            </button>
          </form>

          <p className="mt-3 text-center text-[11px] leading-relaxed text-neutral-400">
            Your browser will offer to save this login so you won&apos;t have to type it next time.
          </p>
          <Link href="/" className="mt-4 block text-center text-xs text-neutral-400 transition-colors hover:text-neutral-700">
            ← Back to the site
          </Link>
        </div>
      </main>
    );
  }

  if (authed === null || !config) {
    return <main className="grid min-h-dvh place-items-center bg-[#f4f6fb] text-sm text-neutral-400">Loading…</main>;
  }

  /* ── panel ── */
  return (
    <main className="min-h-dvh bg-[#f4f6fb] pb-24 text-neutral-900">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/85 px-5 py-3.5 backdrop-blur sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={24} color="#0b0d12" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em]">
            Apex<span style={{ color: ACCENT }}>Ride</span> · Admin
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {(["bookings", "options"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={tab === t ? { background: BLUE, color: "#fff" } : { color: "#525252" }}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/login", { method: "DELETE" });
              setAuthed(false);
            }}
            className="ml-2 text-xs font-semibold text-neutral-400 hover:text-neutral-900"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        {/* ── BOOKINGS ── */}
        {tab === "bookings" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h1 className="font-josefin text-2xl font-light">Bookings</h1>
              <button type="button" onClick={() => void loadAll()} className="text-xs font-semibold" style={{ color: ACCENT }}>
                Refresh
              </button>
            </div>

            {/* notification channels, green when the env var is present on the server */}
            {notifyStatus && (
              <div className={card}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold">
                    <span className="text-neutral-400 uppercase tracking-wider">Notifications</span>
                    {[
                      { on: notifyStatus.resend, name: notifyStatus.resend ? "Email keys OK" : "No RESEND_API_KEY" },
                      { on: Boolean(notifyStatus.companyEmail), name: notifyStatus.companyEmail ? `Alerts → ${notifyStatus.companyEmail}` : "No COMPANY_EMAIL" },
                      { on: Boolean(notifyStatus.ntfyTopic), name: notifyStatus.ntfyTopic ? `Push → ${notifyStatus.ntfyTopic}` : "No NTFY_TOPIC" },
                      { on: notifyStatus.supabase, name: notifyStatus.supabase ? "Supabase connected" : "Supabase not connected" },
                    ].map((c) => (
                      <span key={c.name} className="flex items-center gap-1.5">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.on ? "#16a34a" : "#dc2626" }} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                  <button type="button" onClick={() => void runNotifyTest()} disabled={testing} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-50" style={{ background: BLUE }}>
                    {testing ? "Sending…" : "Send test"}
                  </button>
                </div>
                {testResults && (
                  <div className="mt-3 flex flex-col gap-1 border-t border-neutral-100 pt-3 text-xs">
                    {testResults.map((r) => (
                      <div key={r.channel} className="flex items-start gap-1.5">
                        <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: r.ok ? "#16a34a" : "#dc2626" }} />
                        <span><span className="font-bold uppercase">{r.channel}</span>, {r.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {bookings.length === 0 && <p className="text-sm text-neutral-400">No bookings yet.</p>}
            {bookings.map((b) => {
              const status = (b.status ?? "new") as BookingStatus;
              const open = openRef === b.id;
              return (
                <div key={b.id} className={card}>
                  <button type="button" onClick={() => setOpenRef(open ? null : b.id)} className="flex w-full items-center justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">{b.id}</span>
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={{ background: STATUS_COLORS[status] }}>
                          {status}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-sm text-neutral-500">
                        {b.passenger.name} · {b.car.name} · {b.date} {b.time}
                      </div>
                    </div>
                    <span className="text-neutral-300">{open ? "▴" : "▾"}</span>
                  </button>

                  {open && (
                    <div className="mt-4 grid gap-4 border-t border-neutral-100 pt-4 sm:grid-cols-2">
                      <div className="text-sm leading-relaxed text-neutral-600">
                        <div><span className="font-semibold text-neutral-900">Pickup:</span> {b.pickup}</div>
                        {b.dropoff && <div><span className="font-semibold text-neutral-900">Drop-off:</span> {b.dropoff}</div>}
                        {b.duration && <div><span className="font-semibold text-neutral-900">Duration:</span> {b.duration}</div>}
                        <div><span className="font-semibold text-neutral-900">Service:</span> {b.service}</div>
                        <div className="mt-2">
                          <span className="font-semibold text-neutral-900">Phone:</span>{" "}
                          <a href={`tel:${b.passenger.phone}`} style={{ color: ACCENT }}>{b.passenger.phone}</a>
                          {" · "}
                          <a href={`https://wa.me/${b.passenger.phone.replace(/\D/g, "").replace(/^0/, "234")}`} style={{ color: ACCENT }}>WhatsApp</a>
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
                          className="rounded-xl border p-3"
                          style={{ borderColor: b.paid ? "#16a34a55" : "rgba(0,0,0,0.1)", background: b.paid ? "#16a34a10" : "transparent" }}
                        >
                          <label className="flex cursor-pointer items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={!!b.paid}
                              onChange={(e) => void patchBooking(b.id, { paid: e.target.checked })}
                              className="h-4 w-4 accent-[#16a34a]"
                            />
                            <span className="text-sm font-semibold text-neutral-900">Payment verified (paid)</span>
                          </label>
                          {b.paid && (
                            <a
                              href={whatsappVerifyLink(b)}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2.5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-px"
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
                          <select value={status} onChange={(e) => void patchBooking(b.id, { status: e.target.value as BookingStatus })} className={input}>
                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={label}>Driver</label>
                          <input defaultValue={b.driver ?? ""} onBlur={(e) => void patchBooking(b.id, { driver: e.target.value })} placeholder="e.g. Emeka, black Escalade" className={input} />
                        </div>
                        <div>
                          <label className={label}>Internal notes</label>
                          <textarea defaultValue={b.notes ?? ""} onBlur={(e) => void patchBooking(b.id, { notes: e.target.value })} rows={3} className={`${input} resize-none`} placeholder="Only the team sees this" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── OPTIONS ── */}
        {tab === "options" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h1 className="font-josefin text-2xl font-light">Form options</h1>
              <div className="flex items-center gap-3">
                {savedAt > 0 && <span className="text-xs text-green-700">Saved ✓</span>}
                <button type="button" onClick={() => void saveConfig()} disabled={saving} className={btn} style={{ background: BLUE }}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            {/* popular pickups */}
            <section className={card}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Popular pickup spots</h2>
              <div className="flex flex-col gap-2">
                {config.popularPickups.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={p.city} onChange={(e) => set("popularPickups", config.popularPickups.map((x, j) => (j === i ? { ...x, city: e.target.value } : x)))} className={`${input} !w-28`} placeholder="City" />
                    <input value={p.name} onChange={(e) => set("popularPickups", config.popularPickups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Spot name" />
                  </div>
                ))}
              </div>
            </section>

            {/* durations */}
            <section className={card}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Duration tiers</h2>
              <div className="flex flex-col gap-3">
                {config.durations.map((d, i) => (
                  <div key={d.id} className="grid gap-2 sm:grid-cols-[10rem_6rem_1fr]">
                    <input value={d.name} onChange={(e) => set("durations", config.durations.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} />
                    {d.id !== "multiday" ? (
                      <input type="number" min={1} value={d.hours ?? 0} onChange={(e) => set("durations", config.durations.map((x, j) => (j === i ? { ...x, hours: Number(e.target.value) } : x)))} className={input} />
                    ) : (
                      <span className="self-center text-xs text-neutral-400">per-day</span>
                    )}
                    <input value={d.desc} onChange={(e) => set("durations", config.durations.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} className={input} />
                  </div>
                ))}
              </div>
            </section>

            {/* trip types */}
            <section className={card}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Trip types</h2>
              <div className="flex flex-col gap-3">
                {config.tripTypes.map((t, i) => (
                  <div key={t.id} className="grid gap-2 sm:grid-cols-[12rem_1fr]">
                    <input value={t.name} onChange={(e) => set("tripTypes", config.tripTypes.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} />
                    <input value={t.desc} onChange={(e) => set("tripTypes", config.tripTypes.map((x, j) => (j === i ? { ...x, desc: e.target.value } : x)))} className={input} />
                  </div>
                ))}
              </div>
            </section>

            {/* quick requests */}
            <section className={card}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Quick request chips</h2>
              <div className="flex flex-col gap-2">
                {config.quickRequests.map((q, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={q} onChange={(e) => set("quickRequests", config.quickRequests.map((x, j) => (j === i ? e.target.value : x)))} className={input} />
                    <button type="button" onClick={() => set("quickRequests", config.quickRequests.filter((_, j) => j !== i))} className="shrink-0 text-xs font-semibold text-red-600">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={() => set("quickRequests", [...config.quickRequests, ""])} className="self-start text-xs font-semibold" style={{ color: ACCENT }}>+ Add chip</button>
              </div>
            </section>

            {/* cars */}
            <section className={card}>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Cars</h2>
              <p className="mb-3 text-xs text-neutral-500">
                Added cars appear in the form&apos;s all-cars list and in Quick Booking. Photos come from the existing
                library only, new photos still need a code update.
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {CARS.map((c) => {
                  const hidden = config.hiddenCars.includes(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set("hiddenCars", hidden ? config.hiddenCars.filter((n) => n !== c.name) : [...config.hiddenCars, c.name])}
                      title={hidden ? "Hidden, click to show" : "Shown, click to hide"}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${hidden ? "border-red-200 bg-red-50 text-red-600 line-through" : "border-neutral-200 bg-white text-neutral-700"}`}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-3">
                {config.extraCars.map((c, i) => (
                  <div key={c.id} className="grid gap-2 rounded-xl border border-neutral-100 bg-neutral-50/60 p-3 sm:grid-cols-[1fr_5rem_10rem]">
                    <input value={c.name} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={input} placeholder="Car name" />
                    <input value={c.year} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)))} className={input} placeholder="Year" />
                    <input value={c.type} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className={input} placeholder="Class e.g. Luxury SUV" />
                    <input value={c.specs.join(", ")} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, specs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))} className={`${input} sm:col-span-2`} placeholder="Specs, comma separated" />
                    <div className="flex items-center gap-2">
                      <select value={c.image ?? ""} onChange={(e) => set("extraCars", config.extraCars.map((x, j) => (j === i ? { ...x, image: e.target.value || null } : x)))} className={input}>
                        <option value="">No photo</option>
                        {IMAGE_CHOICES.map((img) => <option key={img} value={img}>{img.split("/")[3]}</option>)}
                      </select>
                      <button type="button" onClick={() => set("extraCars", config.extraCars.filter((_, j) => j !== i))} className="shrink-0 text-xs font-semibold text-red-600">Remove</button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => set("extraCars", [...config.extraCars, { id: `car-${Date.now().toString(36)}`, name: "", year: "", type: "", specs: [], image: null }])}
                  className="self-start text-xs font-semibold"
                  style={{ color: ACCENT }}
                >
                  + Add car
                </button>
              </div>
            </section>

            {/* quick booking cars */}
            <section className={card}>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Quick Booking cars</h2>
              <p className="mb-3 text-xs text-neutral-500">
                Pick which cars appear in the Quick Booking pop-up. {config.quickCars.length === 0 ? "None selected, all cars show." : `${config.quickCars.length} selected.`}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...CARS.filter((c) => c.image), ...config.extraCars].map((c) => {
                  const on = config.quickCars.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set("quickCars", on ? config.quickCars.filter((id) => id !== c.id) : [...config.quickCars, c.id])}
                      className="rounded-full border px-3 py-1 text-[11px] font-medium transition-colors"
                      style={on ? { borderColor: BLUE, background: BLUE, color: "#fff" } : { borderColor: "rgba(0,0,0,0.12)", color: "#525252" }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
              {config.quickCars.length > 0 && (
                <button type="button" onClick={() => set("quickCars", [])} className="mt-3 text-xs font-semibold text-neutral-400 hover:text-neutral-700">
                  Clear (show all)
                </button>
              )}
            </section>

            {/* per-hour prices */}
            <section className={card}>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Prices per hour (₦)</h2>
              <p className="mb-3 text-xs text-neutral-500">
                Shown beside each car in Quick Booking. Leave a car blank to use its built-in default rate.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[...CARS.filter((c) => c.image), ...config.extraCars].map((c) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{c.name}</span>
                    <span className="text-sm text-neutral-400">₦</span>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={config.carRates[c.id] ?? ""}
                      placeholder="default"
                      onChange={(e) => {
                        const next = { ...config.carRates };
                        if (e.target.value === "") delete next[c.id];
                        else next[c.id] = Number(e.target.value);
                        set("carRates", next);
                      }}
                      className={`${input} !w-32 text-right tabular-nums`}
                    />
                    <span className="text-[11px] text-neutral-400">/hr</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <p className="mb-2 text-xs text-neutral-500">Flat fare for each trip type (no hourly duration), charged via Paystack.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {config.tripTypes.map((t) => (
                    <div key={t.id} className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-neutral-700">{t.name}</span>
                      <span className="text-sm text-neutral-400">₦</span>
                      <input
                        type="number"
                        min={0}
                        step={1000}
                        value={config.tripRates[t.id] ?? ""}
                        placeholder="0"
                        onChange={(e) => set("tripRates", { ...config.tripRates, [t.id]: Number(e.target.value) || 0 })}
                        className={`${input} !w-28 text-right tabular-nums`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* payment channel, Paystack */}
            <section className={card}>
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wider" style={{ color: BLUE }}>Payment channel</h2>
              <p className="text-xs leading-relaxed text-neutral-500">
                Customers now pay online through <span className="font-semibold text-neutral-700">Paystack</span> on the last
                step of Quick Booking and the form, card, bank transfer, or USSD. The fare is the per-hour price above ×
                the hours, or the flat trip-type rate. Set any trip rate to 0 to make that trip &ldquo;contact us&rdquo; instead of pay-now.
              </p>
              <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-500">
                Set your keys as environment variables (Vercel → Settings → Environment Variables):
                <br />• <span className="font-mono font-semibold text-neutral-700">NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY</span>, your Paystack public key
                <br />• <span className="font-mono font-semibold text-neutral-700">PAYSTACK_SECRET_KEY</span>, your Paystack secret key
                <br />Until both are set, the pay button will say payments aren&apos;t configured yet.
              </p>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
