"use client";

// The channel-status strip: one dot per alert channel (green when the server
// has what it needs), a "send test" button, and the collapsible Telegram /
// WhatsApp setup. Collapsed by default once at least one chat channel works.

import { useState } from "react";
import { toast } from "sonner";
import { ACCENT, BLUE, card } from "../ui";
import AlertsSetup from "./AlertsSetup";

export type NotifyStatus = {
  resend: boolean;
  companyEmail: string | null;
  ntfyTopic: string | null;
  telegramBot: boolean;
  telegramChats: number;
  whatsappTo: string | null;
  whatsappKey: boolean;
  supabase: boolean;
};

export default function NotificationsCard({
  status,
  onStatusChange,
}: {
  status: NotifyStatus;
  onStatusChange: () => void;
}) {
  const [testResults, setTestResults] = useState<{ channel: string; ok: boolean; detail: string }[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState<boolean | null>(null);

  const telegramReady = Boolean(status.telegramBot && status.telegramChats > 0);
  const whatsappReady = Boolean(status.whatsappTo && status.whatsappKey);
  // The alerts setup starts open until Telegram or WhatsApp is working.
  const showAlerts = alertsOpen ?? !(telegramReady || whatsappReady);

  const runNotifyTest = async () => {
    setTesting(true);
    setTestResults(null);
    const res = await fetch("/api/admin/notify-status", { method: "POST" }).catch(() => null);
    if (res?.ok) {
      const results = (await res.json()).results ?? [];
      setTestResults(results);
      const failed = results.filter((r: { ok: boolean }) => !r.ok).length;
      if (failed === 0) toast.success("Test sent on every channel");
      else toast.warning(`Test sent — ${failed} channel${failed > 1 ? "s" : ""} failed, details below`);
    } else {
      toast.error("The test couldn't run. Try again.");
    }
    setTesting(false);
  };

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold">
          <span className="text-neutral-400 uppercase tracking-wider">Notifications</span>
          {[
            { on: status.resend, name: status.resend ? "Email keys OK" : "No RESEND_API_KEY" },
            { on: Boolean(status.companyEmail), name: status.companyEmail ? `Alerts → ${status.companyEmail}` : "No COMPANY_EMAIL" },
            { on: Boolean(status.ntfyTopic), name: status.ntfyTopic ? `Push → ${status.ntfyTopic}` : "No NTFY_TOPIC" },
            {
              on: telegramReady,
              name: !status.telegramBot
                ? "Telegram not set up"
                : telegramReady
                  ? `Telegram → ${status.telegramChats} chat${status.telegramChats > 1 ? "s" : ""}`
                  : "Telegram: nobody connected",
            },
            { on: whatsappReady, name: whatsappReady ? `WhatsApp → ${status.whatsappTo}` : "WhatsApp not set up" },
            { on: status.supabase, name: status.supabase ? "Supabase connected" : "Supabase not connected" },
          ].map((c) => (
            <span key={c.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.on ? "#16a34a" : "#dc2626" }} />
              {c.name}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void runNotifyTest()}
          disabled={testing}
          className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:opacity-50"
          style={{ background: BLUE }}
        >
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
      <div className="mt-3 border-t border-neutral-100 pt-3">
        <button
          type="button"
          onClick={() => setAlertsOpen(!showAlerts)}
          className="text-xs font-semibold"
          style={{ color: ACCENT }}
        >
          {showAlerts ? "Hide booking alerts setup ▴" : "Booking alerts on Telegram & WhatsApp ▾"}
        </button>
        {showAlerts && (
          <div className="mt-3">
            <AlertsSetup
              onChange={() => {
                setAlertsOpen(true); // stays open while you finish setting up
                onStatusChange();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
