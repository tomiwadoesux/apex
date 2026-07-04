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
  const [password, setPassword] = useState("");
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

  const patchBooking = async (ref: string, patch: Partial<Pick<Booking, "status" | "driver" | "notes">>) => {
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
      <main className="grid min-h-dvh place-items-center bg-[#f4f6fb] px-6 text-neutral-900">
        <div className={`w-full max-w-sm ${card}`}>
          <div className="mb-5 flex items-center gap-2.5">
            <Logo size={26} color="#0b0d12" accent={ACCENT} />
            <span className="text-sm font-bold uppercase tracking-[0.08em]">
              Apex<span style={{ color: ACCENT }}>Ride</span> · Admin
            </span>
          </div>
          <label className={label}>Admin password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void login()}
            className={input}
            placeholder="••••••••"
            autoFocus
          />
          {loginError && <p className="mt-2 text-xs font-medium text-red-600">{loginError}</p>}
          <button type="button" onClick={() => void login()} className={`${btn} mt-4 w-full`} style={{ background: BLUE }}>
            Sign in
          </button>
          <Link href="/" className="mt-4 block text-center text-xs text-neutral-400 hover:text-neutral-700">
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

            {/* notification channels — green when the env var is present on the server */}
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
                        <span><span className="font-bold uppercase">{r.channel}</span> — {r.detail}</span>
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
                      </div>
                      <div className="flex flex-col gap-3">
                        <div>
                          <label className={label}>Status</label>
                          <select value={status} onChange={(e) => void patchBooking(b.id, { status: e.target.value as BookingStatus })} className={input}>
                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={label}>Driver</label>
                          <input defaultValue={b.driver ?? ""} onBlur={(e) => void patchBooking(b.id, { driver: e.target.value })} placeholder="e.g. Emeka — black Escalade" className={input} />
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
                library only — new photos still need a code update.
              </p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {CARS.map((c) => {
                  const hidden = config.hiddenCars.includes(c.name);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => set("hiddenCars", hidden ? config.hiddenCars.filter((n) => n !== c.name) : [...config.hiddenCars, c.name])}
                      title={hidden ? "Hidden — click to show" : "Shown — click to hide"}
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
          </div>
        )}
      </div>
    </main>
  );
}
