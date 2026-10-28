"use client";

// The bookings list: search (name / phone / ref / car / pickup), status filter
// chips plus an "unpaid" lens, and rows grouped by when the trip happens —
// Today first, then Upcoming, then Past. Clicking a row opens the drawer.

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Booking } from "@/lib/bookings";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/siteConfigDefaults";
import { BLUE, STATUS_COLORS, STATUS_TINTS, input, naira, parseBookingDate } from "../ui";

export type BookingFilter = "all" | "unpaid" | BookingStatus;

const DAY = 24 * 60 * 60 * 1000;

function groupOf(b: Booking, now: number): "Today" | "Upcoming" | "Past" {
  const t = parseBookingDate(b.date, b.time);
  if (Number.isNaN(t)) return "Upcoming"; // unparseable date: keep it visible
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  if (t >= start.getTime() && t < start.getTime() + DAY) return "Today";
  return t >= start.getTime() + DAY ? "Upcoming" : "Past";
}

export default function BookingList({
  bookings,
  filter,
  onFilter,
  onOpen,
}: {
  bookings: Booking[];
  filter: BookingFilter;
  onFilter: (f: BookingFilter) => void;
  onOpen: (b: Booking) => void;
}) {
  const [query, setQuery] = useState("");
  // Captured once on mount: render stays pure, and "today" holding still for
  // the session is fine for grouping.
  const [now] = useState(() => Date.now());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const shown = bookings.filter((b) => {
      const status = (b.status ?? "new") as BookingStatus;
      if (filter === "unpaid" && (b.paid || status === "cancelled" || status === "completed")) return false;
      if (filter !== "all" && filter !== "unpaid" && status !== filter) return false;
      if (!q) return true;
      return [b.id, b.passenger.name, b.passenger.phone, b.passenger.email, b.car.name, b.pickup, b.dropoff ?? "", b.driver ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
    const buckets: Record<string, Booking[]> = { Today: [], Upcoming: [], Past: [] };
    for (const b of shown) buckets[groupOf(b, now)].push(b);
    buckets.Today.sort((a, z) => parseBookingDate(a.date, a.time) - parseBookingDate(z.date, z.time));
    buckets.Upcoming.sort((a, z) => parseBookingDate(a.date, a.time) - parseBookingDate(z.date, z.time));
    buckets.Past.sort((a, z) => parseBookingDate(z.date, z.time) - parseBookingDate(a.date, a.time));
    return (["Today", "Upcoming", "Past"] as const).filter((g) => buckets[g].length).map((g) => ({ name: g, items: buckets[g] }));
  }, [bookings, filter, query, now]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: bookings.length, unpaid: 0 };
    for (const s of BOOKING_STATUSES) c[s] = 0;
    for (const b of bookings) {
      const status = (b.status ?? "new") as BookingStatus;
      c[status]++;
      if (!b.paid && status !== "cancelled" && status !== "completed") c.unpaid++;
    }
    return c;
  }, [bookings]);

  const empty = groups.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, phone, ref, car, pickup…"
        className={input}
      />

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
        {(["all", "unpaid", ...BOOKING_STATUSES] as BookingFilter[]).map((f) => {
          const on = filter === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => onFilter(f)}
              className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-[transform,background-color,color,border-color] duration-150 ease-out active:scale-[0.96]"
              style={on ? { background: BLUE, borderColor: BLUE, color: "#fff" } : { borderColor: "rgba(0,0,0,0.12)", color: "#525252" }}
            >
              {f} <span className="opacity-60 tabular-nums">{counts[f] ?? 0}</span>
            </button>
          );
        })}
      </div>

      {empty && (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
          {bookings.length === 0
            ? "No bookings yet. New requests from the site land here the moment they're made."
            : "Nothing matches this view. Clear the search or switch the filter above."}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.name}>
          <h2 className="mb-2 mt-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
            {g.name} · {g.items.length}
          </h2>
          <div className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {g.items.map((b) => {
                const status = (b.status ?? "new") as BookingStatus;
                return (
                  <motion.button
                    key={b.id}
                    layout="position"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    type="button"
                    onClick={() => onOpen(b)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-left shadow-sm transition-shadow duration-150 hover:shadow-md"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums">{b.id}</span>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                          style={{ background: STATUS_TINTS[status], color: STATUS_COLORS[status] }}
                        >
                          {status}
                        </span>
                        {!b.paid && status !== "cancelled" && status !== "completed" && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                            unpaid
                          </span>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm text-neutral-500">
                        {b.passenger.name} · {b.car.name} · {b.date} {b.time}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {typeof b.amount === "number" && b.amount > 0 && (
                        <span className="text-sm font-semibold tabular-nums text-neutral-900">{naira(b.amount)}</span>
                      )}
                      <span className="text-neutral-300">›</span>
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
