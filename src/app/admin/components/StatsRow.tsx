"use client";

// Four at-a-glance tiles above the bookings list: what's new, what's riding
// today, what still needs payment, and verified revenue over the last 7 days.

import { useState } from "react";
import type { Booking } from "@/lib/bookings";
import { naira, parseBookingDate } from "../ui";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default function StatsRow({ bookings, onPick }: { bookings: Booking[]; onPick: (filter: "new" | "unpaid") => void }) {
  // Captured once on mount (render must stay pure); the panel is short-lived
  // enough that "today" never drifts within one session's view.
  const [now] = useState(() => Date.now());
  const [todayKey] = useState(() => new Date().toDateString());

  const fresh = bookings.filter((b) => (b.status ?? "new") === "new").length;
  const today = bookings.filter((b) => {
    const t = parseBookingDate(b.date, b.time);
    return !Number.isNaN(t) && new Date(t).toDateString() === todayKey && b.status !== "cancelled";
  }).length;
  const unpaid = bookings.filter((b) => !b.paid && b.status !== "cancelled" && b.status !== "completed").length;
  const revenue = bookings
    .filter((b) => b.paid && b.amount && now - b.createdAt < WEEK)
    .reduce((sum, b) => sum + (b.amount ?? 0), 0);

  const tiles: { name: string; value: string; hint: string; onClick?: () => void }[] = [
    { name: "New requests", value: String(fresh), hint: "awaiting confirmation", onClick: () => onPick("new") },
    { name: "Trips today", value: String(today), hint: "on the calendar" },
    { name: "Unpaid", value: String(unpaid), hint: "payment not verified", onClick: () => onPick("unpaid") },
    { name: "Revenue · 7 days", value: naira(revenue), hint: "verified payments" },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
      {tiles.map((t) => (
        <button
          key={t.name}
          type="button"
          onClick={t.onClick}
          disabled={!t.onClick}
          className="rounded-2xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition-[transform,box-shadow] duration-150 ease-out enabled:hover:shadow-md enabled:active:scale-[0.98] sm:p-4"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{t.name}</div>
          <div className="mt-1 truncate text-xl font-semibold tabular-nums text-neutral-900 sm:text-2xl">{t.value}</div>
          <div className="mt-0.5 text-[11px] text-neutral-400">{t.hint}</div>
        </button>
      ))}
    </div>
  );
}
