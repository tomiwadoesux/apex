// Shared look-and-feel for the admin panel: brand colors, status palette, and
// the Tailwind class strings every admin component composes from. One place to
// tune, so the panel stays visually consistent as it grows.

import type { BookingStatus } from "@/lib/siteConfigDefaults";

export const BLUE = "#00209C";
export const ACCENT = "#2A4FD0";

export const STATUS_COLORS: Record<BookingStatus, string> = {
  new: "#b45309",
  confirmed: "#1d4ed8",
  assigned: "#7c3aed",
  completed: "#15803d",
  cancelled: "#b91c1c",
};

// Soft tint backgrounds for status chips (badge bg at ~10% of the solid color).
export const STATUS_TINTS: Record<BookingStatus, string> = {
  new: "#b4530914",
  confirmed: "#1d4ed814",
  assigned: "#7c3aed14",
  completed: "#15803d14",
  cancelled: "#b91c1c14",
};

export const input =
  "w-full rounded-xl border border-neutral-900/10 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]";

export const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500";

export const card = "rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm";

// Buttons scale down slightly on press — motion on transform only, spring-like
// release via the transition, per the usual interaction-design playbook.
export const btn =
  "inline-flex h-10 items-center justify-center rounded-full px-5 text-sm font-semibold tracking-wide text-white transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const chip =
  "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors duration-150";

// Formats Naira without decimals: ₦1,250,000.
export const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

// b.date is human-readable ("Sat, 21 Jun 2026"); parse defensively.
export const parseBookingDate = (date: string, time: string): number => {
  const t = Date.parse(`${date} ${time || "00:00"}`);
  return Number.isNaN(t) ? Date.parse(date) : t;
};
