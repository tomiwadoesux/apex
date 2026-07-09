// A booking that's been placed but not yet paid for. Stored in localStorage so
// the payment screen survives a tab/app close and comes back next visit — the
// guest keeps their work order until they've transferred the fare and submitted
// their receipt. Only the small booking record + note are kept (never the
// receipt image, which can be large); the receipt is re-attached on submit.

import type { Booking } from "./bookings";

export type PendingPayment = { booking: Booking; note: string };

const KEY = "apexride:pendingPayment";

export function loadPending(): PendingPayment | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingPayment;
    return p?.booking?.id ? p : null;
  } catch {
    return null;
  }
}

export function savePending(p: PendingPayment): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode / quota — persistence just won't survive reloads */
  }
}

export function clearPending(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
