"use client";

// The payment step shared by Quick Booking and the full form. Shows ApexRide's
// bank details (each with a copy button), lets the guest attach a photo of their
// transfer receipt, and gives them a note box for the account name, amount, and
// roughly when they paid. All three feed the booking email to the team.

import { useRef, useState } from "react";
import { PAYMENT } from "@/lib/payment";
import type { PaymentInfo } from "@/lib/siteConfigDefaults";

export type PaymentDetails = {
  note: string; // account name + amount + rough time paid
  receipt: string | null; // data URL of the uploaded receipt image
  receiptName: string | null;
};

export const EMPTY_PAYMENT: PaymentDetails = { note: "", receipt: null, receiptName: null };

const MAX_RECEIPT_BYTES = 6 * 1024 * 1024; // 6 MB — comfortably under the email attachment ceiling

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function PaymentSection({
  value,
  onChange,
  bank = PAYMENT,
  isLight = true,
}: {
  value: PaymentDetails;
  onChange: (v: PaymentDetails) => void;
  bank?: PaymentInfo;
  isLight?: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const accent = isLight ? "#00209C" : "#FDBA16";

  const copy = async (field: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked (insecure context / permissions) — select-based fallback.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* nothing more we can do */ }
      document.body.removeChild(ta);
    }
    setCopied(field);
    window.setTimeout(() => setCopied((c) => (c === field ? null : c)), 1600);
  };

  const pickReceipt = (file: File | null) => {
    setFileError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Please attach an image of your receipt.");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setFileError("That image is over 6 MB — please attach a smaller photo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange({ ...value, receipt: String(reader.result), receiptName: file.name });
    reader.onerror = () => setFileError("Could not read that file. Try another photo.");
    reader.readAsDataURL(file);
  };

  const rowCls = isLight
    ? "flex items-center justify-between gap-3 rounded-xl border border-neutral-900/10 bg-white/60 px-3.5 py-2.5"
    : "flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5";
  const labelCls = isLight ? "text-[10px] uppercase tracking-wider text-neutral-400" : "text-[10px] uppercase tracking-wider text-white/40";
  const valueCls = isLight ? "text-sm font-semibold text-neutral-900" : "text-sm font-semibold text-white";

  const detail = (field: string, label: string, text: string, mono = false) => (
    <div className={rowCls}>
      <div className="min-w-0">
        <div className={labelCls}>{label}</div>
        <div className={`${valueCls} truncate ${mono ? "tabular-nums tracking-wide" : ""}`}>{text}</div>
      </div>
      <button
        type="button"
        onClick={() => void copy(field, text)}
        aria-label={`Copy ${label}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
        style={{ color: copied === field ? "#16a34a" : accent, backgroundColor: (copied === field ? "#16a34a" : accent) + "14" }}
      >
        {copied === field ? <CheckIcon /> : <CopyIcon />}
        {copied === field ? "Copied" : "Copy"}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <p className={`text-xs leading-relaxed ${isLight ? "text-neutral-900/55" : "text-white/50"}`}>
        Transfer the fare to the account below, then attach your receipt and a short note so our team can confirm your booking.
      </p>

      {detail("bank", "Bank", bank.bankName)}
      {detail("account", "Account number", bank.accountNumber, true)}
      {detail("name", "Account name", bank.accountName)}

      {/* Receipt attachment */}
      <div>
        <label className={`mb-1.5 block text-xs font-semibold tracking-wide ${isLight ? "text-neutral-500" : "text-white/55"}`}>
          Upload payment receipt
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickReceipt(e.target.files?.[0] ?? null)}
        />
        {value.receipt ? (
          <div className={`flex items-center gap-3 rounded-xl border p-2.5 ${isLight ? "border-neutral-900/10 bg-white/60" : "border-white/10 bg-white/[0.04]"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.receipt} alt="Receipt preview" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            <span className={`min-w-0 flex-1 truncate text-xs ${isLight ? "text-neutral-700" : "text-white/70"}`}>{value.receiptName}</span>
            <button
              type="button"
              onClick={() => { onChange({ ...value, receipt: null, receiptName: null }); if (fileRef.current) fileRef.current.value = ""; }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${isLight ? "text-neutral-500 hover:text-neutral-900" : "text-white/50 hover:text-white"}`}
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-4 text-xs font-semibold transition-colors ${
              isLight
                ? "border-neutral-900/20 bg-white/40 text-neutral-500 hover:border-[#00209C]/50 hover:text-[#00209C]"
                : "border-white/20 bg-white/[0.03] text-white/50 hover:border-[#FDBA16]/50 hover:text-[#FDBA16]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Attach a photo of your receipt
          </button>
        )}
        {fileError && <p className="mt-1.5 text-[10px] font-medium text-red-600">{fileError}</p>}
      </div>

      {/* Payment note */}
      <div>
        <label className={`mb-1.5 block text-xs font-semibold tracking-wide ${isLight ? "text-neutral-500" : "text-white/55"}`}>
          Payment details
        </label>
        <textarea
          value={value.note}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
          maxLength={400}
          placeholder="Account name you paid from, how much you sent, and roughly when (a 10-minute window is fine — e.g. 'John Doe, ₦180,000, around 2:30pm')."
          className={`h-24 w-full resize-none rounded-xl border px-4 py-3 text-base outline-none sm:text-sm transition-colors ${
            isLight
              ? "border-neutral-900/10 bg-white/70 text-neutral-900 placeholder:text-neutral-400 focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C]"
              : "border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 focus:border-[#FDBA16] focus:ring-1 focus:ring-[#FDBA16]"
          }`}
        />
      </div>
    </div>
  );
}
