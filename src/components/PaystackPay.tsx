"use client";

// The Paystack payment panel shared by Quick Booking and the form. Shows the
// fare and opens the Paystack Inline popup; on success it verifies the
// transaction server-side (the only place payment is trusted) and calls onPaid.
//
// Needs NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY on the client and PAYSTACK_SECRET_KEY on
// the server. Without them the button explains that payments aren't set up yet.

import { useEffect, useState } from "react";
import { naira } from "@/lib/pricing";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

type PaystackHandler = { openIframe: () => void };
type PaystackSetup = {
  key: string;
  email: string;
  amount: number;
  currency?: string;
  ref?: string;
  metadata?: Record<string, unknown>;
  callback?: (r: { reference: string }) => void;
  onClose?: () => void;
};
declare global {
  interface Window {
    PaystackPop?: { setup: (o: PaystackSetup) => PaystackHandler };
  }
}

export default function PaystackPay({
  bookingId,
  email,
  amountNaira,
  isLight = true,
  onPaid,
}: {
  bookingId: string;
  email: string;
  amountNaira: number;
  isLight?: boolean;
  onPaid: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accent = isLight ? "#00209C" : "#FDBA16";

  // Load Paystack Inline once.
  useEffect(() => {
    if (document.getElementById("paystack-inline")) return;
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.id = "paystack-inline";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const pay = () => {
    setError(null);
    if (!PUBLIC_KEY) {
      setError("Online payment isn't set up yet. Please contact us to complete your booking.");
      return;
    }
    if (!window.PaystackPop) {
      setError("Payment is still loading — give it a second and tap again.");
      return;
    }
    setBusy(true);
    const ref = `APX${bookingId.replace(/\D/g, "")}-${Date.now()}`;
    const handler = window.PaystackPop.setup({
      key: PUBLIC_KEY,
      email,
      amount: Math.round(amountNaira * 100), // kobo
      currency: "NGN",
      ref,
      metadata: { bookingId, custom_fields: [{ display_name: "Work order", variable_name: "work_order", value: bookingId }] },
      callback: (resp) => {
        // Verify server-side before we treat the booking as paid.
        fetch("/api/paystack/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference: resp.reference }),
        })
          .then((r) => r.json())
          .then((d) => {
            setBusy(false);
            if (d?.ok) onPaid();
            else setError("We couldn't confirm the payment. If you were charged, contact us with your work order ID.");
          })
          .catch(() => {
            setBusy(false);
            setError("Couldn't confirm the payment. If you were charged, contact us with your work order ID.");
          });
      },
      onClose: () => setBusy(false),
    });
    handler.openIframe();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`rounded-2xl border px-4 py-4 text-center ${isLight ? "border-neutral-900/10 bg-white/60" : "border-white/10 bg-white/[0.04]"}`}>
        <div className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? "text-neutral-400" : "text-white/40"}`}>Amount to pay</div>
        <div className="mt-0.5 text-3xl font-bold tabular-nums" style={{ color: accent }}>{naira(amountNaira)}</div>
        <div className={`mt-1 text-[11px] ${isLight ? "text-neutral-500" : "text-white/50"}`}>Secured by Paystack — card, transfer, USSD or bank.</div>
      </div>
      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="h-12 rounded-full text-sm font-bold tracking-wide text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: accent, color: isLight ? "#fff" : "#0a0a0a", boxShadow: "inset 0 2px 4px rgba(255,255,255,0.25)" }}
      >
        {busy ? "Opening Paystack…" : `Pay ${naira(amountNaira)} with Paystack`}
      </button>
      {error && <p className="text-center text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
