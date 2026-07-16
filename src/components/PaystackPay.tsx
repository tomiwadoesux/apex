"use client";

// The Paystack payment panel shared by Quick Booking and the form. Shows the
// fare and opens the Paystack Inline popup; on success it verifies the
// transaction server-side (the only place payment is trusted) and calls onPaid.
//
// Needs NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY on the client and PAYSTACK_SECRET_KEY on
// the server. Without them the button explains that payments aren't set up yet.

import { useEffect, useState } from "react";
import { naira } from "@/lib/pricing";

const BUILD_TIME_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

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
  const [publicKey, setPublicKey] = useState<string | undefined>(BUILD_TIME_KEY);
  const accent = isLight ? "#00209C" : "#FDBA16";

  // Load Paystack Inline once, and — if the key wasn't baked in at build time —
  // fetch it from the server at runtime so the button works as soon as it's set.
  useEffect(() => {
    if (!document.getElementById("paystack-inline")) {
      const s = document.createElement("script");
      s.src = "https://js.paystack.co/v1/inline.js";
      s.id = "paystack-inline";
      s.async = true;
      document.body.appendChild(s);
    }
    if (!publicKey) {
      fetch("/api/paystack/config")
        .then((r) => r.json())
        .then((d) => { if (d?.publicKey) setPublicKey(d.publicKey); })
        .catch(() => {});
    }
  }, [publicKey]);

  const pay = () => {
    setError(null);
    if (!publicKey) {
      setError("Online payment isn't set up yet. Please contact us to complete your booking.");
      return;
    }
    if (!window.PaystackPop) {
      setError("Payment is still loading, give it a second and tap again.");
      return;
    }
    setBusy(true);
    const ref = `APX${bookingId.replace(/\D/g, "")}-${Date.now()}`;
    // Paystack requires a valid email. Use the guest's if they gave a real one,
    // otherwise a valid placeholder on our own domain.
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const payerEmail = EMAIL_RE.test((email || "").trim())
      ? email.trim()
      : `ride-${bookingId.replace(/[^a-z0-9]/gi, "").toLowerCase()}@apexriderental.com`;
    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: payerEmail,
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

  const methods = ["Card", "Transfer", "USSD", "Bank"];

  return (
    <div className="flex flex-col gap-3.5">
      {/* amount card */}
      <div
        className="relative overflow-hidden rounded-3xl px-5 py-6 text-center"
        style={{
          background: isLight
            ? "linear-gradient(160deg, #f3f6ff 0%, #eef2ff 55%, #e7ecff 100%)"
            : "linear-gradient(160deg, rgba(253,186,22,0.10), rgba(255,255,255,0.03))",
          border: `1px solid ${accent}22`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-[0.12]"
          style={{ background: accent }}
        />
        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1" style={{ background: accent + "14", color: accent }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Amount to pay</span>
        </div>
        <div className="mt-2 text-[2.6rem] font-bold leading-none tabular-nums" style={{ color: accent }}>{naira(amountNaira)}</div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {methods.map((m) => (
            <span key={m} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isLight ? "bg-white/70 text-neutral-600" : "bg-white/10 text-white/70"}`}>{m}</span>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={pay}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-full py-4 text-sm font-bold tracking-wide transition-all hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        style={{ background: accent, color: isLight ? "#fff" : "#0a0a0a", boxShadow: `0 8px 20px -8px ${accent}99` }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        {busy ? "Opening Paystack…" : `Pay ${naira(amountNaira)}`}
      </button>
      <p className={`text-center text-[10px] ${isLight ? "text-neutral-400" : "text-white/40"}`}>Secured by Paystack. Your card details never touch our site.</p>
      {error && <p className="text-center text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  );
}
