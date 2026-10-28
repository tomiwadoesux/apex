"use client";

// /admin — the team's panel. Password login (ADMIN_PASSWORD env var), then two
// tabs: BOOKINGS (stats, search, filters, and a per-booking drawer for status /
// driver / notes / payment) and OPTIONS (everything on the booking form that
// has an option — edits autosave). The pieces live in ./components; shared
// styles in ./ui.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import Logo from "@/components/Logo";
import type { SiteConfig } from "@/lib/siteConfigDefaults";
import type { Booking } from "@/lib/bookings";
import { ACCENT, BLUE } from "./ui";
import LoginCard from "./components/LoginCard";
import StatsRow from "./components/StatsRow";
import BookingList, { type BookingFilter } from "./components/BookingList";
import BookingDrawer from "./components/BookingDrawer";
import NotificationsCard, { type NotifyStatus } from "./components/NotificationsCard";
import OptionsTab from "./components/OptionsTab";

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [loginError, setLoginError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [tab, setTab] = useState<"bookings" | "options">("bookings");

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadError, setLoadError] = useState("");
  const [openRef, setOpenRef] = useState<string | null>(null);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [notifyStatus, setNotifyStatus] = useState<NotifyStatus | null>(null);

  // Never throws: a failed request becomes a visible error instead of silently
  // leaving the panel on the login screen (which looked like a wrong password).
  const loadAll = useCallback(async (): Promise<"ok" | "unauthorized" | "failed"> => {
    try {
      const [b, c, n] = await Promise.all([
        fetch("/api/admin/bookings"),
        fetch("/api/admin/config"),
        fetch("/api/admin/notify-status"),
      ]);
      if (b.status === 401 || c.status === 401) {
        setAuthed(false);
        return "unauthorized";
      }
      const data = (await b.json().catch(() => null)) as { bookings?: Booking[]; error?: string } | null;
      setBookings(data?.bookings ?? []);
      setLoadError(b.ok ? "" : data?.error || `Bookings couldn't load (error ${b.status}). Press Refresh to try again.`);
      const cfg = c.ok ? ((await c.json().catch(() => null)) as SiteConfig | null) : null;
      if (cfg) setConfig(cfg);
      if (n.ok) setNotifyStatus(await n.json().catch(() => null));
      setAuthed(true);
      return "ok";
    } catch {
      setLoadError("Couldn't reach the server. Check your connection, then try again.");
      setAuthed((a) => a ?? false);
      return "failed";
    }
  }, []);

  // Re-reads the channel dots after the alerts setup changes.
  const refreshNotifyStatus = async () => {
    const res = await fetch("/api/admin/notify-status").catch(() => null);
    const data = res?.ok ? await res.json().catch(() => null) : null;
    if (data) setNotifyStatus(data);
  };

  useEffect(() => {
    // deferred a tick so the data fetch never sets state inside the effect body
    const t = setTimeout(() => void loadAll(), 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  const login = async (password: string) => {
    if (signingIn) return;
    setLoginError("");
    setLoadError("");
    setSigningIn(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setLoginError((await res.json().catch(() => null))?.error ?? `Login failed (error ${res.status}).`);
        return;
      }
      // The password was right; if the panel still can't see the session, the
      // browser dropped the cookie.
      if ((await loadAll()) === "unauthorized") {
        setLoginError("Password accepted, but your browser didn't keep the login. Allow cookies for this site, open it over https://, and try again.");
      }
    } catch {
      setLoginError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSigningIn(false);
    }
  };

  const patchBooking = async (ref: string, patch: Partial<Pick<Booking, "status" | "driver" | "notes" | "paid">>) => {
    // optimistic — the row updates immediately, the server confirms
    setBookings((all) => all.map((b) => (b.id === ref ? { ...b, ...patch } : b)));
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(ref)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res?.ok) {
      toast.error(`Your change to ${ref} didn't save${res ? ` (error ${res.status})` : ""}`, {
        action: { label: "Refresh", onClick: () => void loadAll() },
      });
    }
  };

  /* ── login / loading screens ── */
  if (authed === false) return <LoginCard error={loginError || loadError} signingIn={signingIn} onSubmit={(p) => void login(p)} />;

  if (authed === null) {
    return (
      <main className="min-h-dvh bg-[#f4f6fb] px-4 pt-20 sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-200/60" style={{ animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      </main>
    );
  }

  const openBooking = bookings.find((b) => b.id === openRef) ?? null;

  /* ── panel ── */
  return (
    <main className="min-h-dvh bg-[#f4f6fb] pb-24 text-neutral-900">
      <Toaster position="top-center" richColors closeButton />
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white/85 px-5 py-3.5 backdrop-blur sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={24} color="#0b0d12" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em]">
            Apex<span style={{ color: ACCENT }}>Ride</span> · Admin
          </span>
        </Link>
        <div className="flex items-center gap-1">
          {(["bookings", "options"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className="relative rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={{ color: tab === t ? "#fff" : "#525252" }}
            >
              {tab === t && (
                <motion.span
                  layoutId="admin-tab-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ background: BLUE }}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <span className="relative">{t}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/login", { method: "DELETE" });
              setLoadError("");
              setAuthed(false);
            }}
            className="ml-2 text-xs font-semibold text-neutral-400 hover:text-neutral-900"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          {tab === "bookings" && (
            <motion.div
              key="bookings"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center justify-between">
                <h1 className="font-josefin text-2xl font-light">Bookings</h1>
                <button type="button" onClick={() => void loadAll()} className="text-xs font-semibold" style={{ color: ACCENT }}>
                  Refresh
                </button>
              </div>

              <StatsRow bookings={bookings} onPick={(f) => setFilter(f)} />

              {notifyStatus && <NotificationsCard status={notifyStatus} onStatusChange={() => void refreshNotifyStatus()} />}

              {loadError && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-relaxed text-red-700">{loadError}</div>
              )}

              <BookingList bookings={bookings} filter={filter} onFilter={setFilter} onOpen={(b) => setOpenRef(b.id)} />
            </motion.div>
          )}

          {tab === "options" && (
            <motion.div
              key="options"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {config ? (
                <OptionsTab config={config} onConfig={setConfig} />
              ) : (
                <p className="text-sm text-red-600">The form options couldn&apos;t load. Press Refresh on the Bookings tab to try again.</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BookingDrawer booking={openBooking} onClose={() => setOpenRef(null)} onPatch={(ref, patch) => void patchBooking(ref, patch)} />
    </main>
  );
}
