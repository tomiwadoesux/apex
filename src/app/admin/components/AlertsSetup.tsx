"use client";

// Booking alerts: the Telegram + WhatsApp setup.
// Saved on the server (/api/admin/alerts), so changes apply at once, no redeploy.

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ACCENT, BLUE, btn, input, label } from "../ui";

type AlertChat = { id: string; name: string };
type AlertsView = {
  telegram: { bot: { username: string; name: string } | null; chats: AlertChat[] };
  whatsapp: { phone: string | null };
  seen?: AlertChat[];
};

export default function AlertsSetup({ onChange }: { onChange: () => void }) {
  const [view, setView] = useState<AlertsView | null>(null);
  const [seen, setSeen] = useState<AlertChat[] | null>(null); // last "Find" result
  const [token, setToken] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waKey, setWaKey] = useState("");
  const [busy, setBusy] = useState(""); // the action in flight
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // deferred a tick so the data fetch never sets state inside the effect body
    const t = setTimeout(async () => {
      const res = await fetch("/api/admin/alerts").catch(() => null);
      const data = await res?.json().catch(() => null);
      if (res?.ok && data) setView(data);
      else setError(data?.error ?? "Couldn't load the alerts setup. Press Refresh to try again.");
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const act = async (action: string, extra: Record<string, unknown> = {}): Promise<boolean> => {
    setBusy(action);
    setError("");
    try {
      const res = await fetch("/api/admin/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = (await res.json().catch(() => null)) as (AlertsView & { error?: string }) | null;
      if (!res.ok || !data) {
        setError(data?.error ?? `That didn't work (error ${res.status}). Try again.`);
        return false;
      }
      setView(data);
      if (action === "telegram:find") setSeen(data.seen ?? []);
      if (action === "telegram:connect") setSeen((list) => list?.filter((c) => c.id !== extra.id) ?? null);
      if (action === "telegram:remove-bot") setSeen(null);
      onChange();
      return true;
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const bot = view?.telegram.bot;
  const link = bot ? `https://t.me/${bot.username}` : "";
  const smallBtn = "rounded-full px-3 py-1 text-xs font-bold text-white disabled:opacity-50";

  return (
    <div className="flex flex-col gap-5 text-sm text-neutral-700">
      {/* ── Telegram ── */}
      <div>
        <div className={label}>Telegram{bot ? "" : " (recommended)"}</div>
        {!view ? (
          !error && <p className="text-xs text-neutral-400">Loading…</p>
        ) : !bot ? (
          <>
            <p className="text-xs leading-relaxed text-neutral-500">
              In Telegram, message <b>@BotFather</b>, send <b>/newbot</b>{" "}and answer its two questions (a name, then a
              username ending in &ldquo;bot&rdquo;). Paste the token it sends you here.
            </p>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void act("telegram:set-bot", { token }).then((ok) => ok && setToken(""));
              }}
            >
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:AAH…"
                className={input}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <button type="submit" disabled={!token.trim() || !!busy} className={`${btn} shrink-0`} style={{ background: BLUE }}>
                {busy === "telegram:set-bot" ? "Checking…" : "Save"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Bot:{" "}
                <a href={link} target="_blank" rel="noreferrer" className="font-semibold" style={{ color: ACCENT }}>
                  @{bot.username}
                </a>
              </span>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  if (window.confirm("Remove the bot? Nobody will get Telegram alerts until you add one again.")) void act("telegram:remove-bot");
                }}
                className="text-xs font-semibold text-red-600"
              >
                Remove bot
              </button>
            </div>

            <div className="mt-3 flex items-center gap-4 rounded-xl bg-neutral-50 p-3">
              <QRCodeSVG value={link} size={84} className="shrink-0 rounded bg-white p-1" />
              <div className="min-w-0 text-xs leading-relaxed text-neutral-600">
                Send this link to everyone who should get booking alerts, or let them scan the code. They open it and tap{" "}
                <b>Start</b>.
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3">
                  <span className="font-mono font-semibold text-neutral-800">{link.replace("https://", "")}</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {
                        /* clipboard blocked: the link is on screen to copy by hand */
                      }
                    }}
                    className="font-semibold"
                    style={{ color: ACCENT }}
                  >
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-xs font-semibold text-neutral-500">Getting alerts</div>
              {view.telegram.chats.length === 0 ? (
                <p className="mt-1 text-xs text-neutral-400">Nobody yet.</p>
              ) : (
                view.telegram.chats.map((c) => (
                  <div key={c.id} className="flex items-center justify-between border-b border-neutral-100 py-1.5 last:border-0">
                    <span className="font-medium">{c.name}</span>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => void act("telegram:disconnect", { id: c.id })}
                      className="text-xs font-semibold text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => void act("telegram:find")}
              disabled={!!busy}
              className="mt-3 rounded-full border px-3.5 py-1.5 text-xs font-bold disabled:opacity-50"
              style={{ borderColor: BLUE, color: BLUE }}
            >
              {busy === "telegram:find" ? "Looking…" : "Find people who tapped Start"}
            </button>
            {seen &&
              (seen.length ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  {seen.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2">
                      <span className="font-medium">{c.name}</span>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => void act("telegram:connect", { id: c.id, name: c.name })}
                        className={smallBtn}
                        style={{ background: "#16a34a" }}
                      >
                        {busy === "telegram:connect" ? "Connecting…" : "Connect"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                  Nobody new yet. Ask them to open the link and tap Start (or send the bot any message), then press Find again.
                </p>
              ))}
          </>
        )}
      </div>

      {/* ── WhatsApp (CallMeBot) ── */}
      {view && (
        <div>
          <div className={label}>WhatsApp (optional)</div>
          {view.whatsapp.phone ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                Alerts go to <b>{view.whatsapp.phone}</b>
              </span>
              <button type="button" disabled={!!busy} onClick={() => void act("whatsapp:remove")} className="text-xs font-semibold text-red-600">
                Remove
              </button>
            </div>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-neutral-500">
                Free through CallMeBot, for one number. On the phone that should get the alerts, open callmebot.com, choose
                &ldquo;WhatsApp API&rdquo; and follow the steps: you message their number once and they reply with a key.
              </p>
              <form
                className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void act("whatsapp:set", { phone: waPhone, key: waKey }).then((ok) => {
                    if (ok) {
                      setWaPhone("");
                      setWaKey("");
                    }
                  });
                }}
              >
                <input value={waPhone} onChange={(e) => setWaPhone(e.target.value)} type="tel" placeholder="WhatsApp number, e.g. 0904 338 0193" className={input} />
                <input
                  value={waKey}
                  onChange={(e) => setWaKey(e.target.value)}
                  placeholder="Key from CallMeBot"
                  className={input}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button type="submit" disabled={!waPhone.trim() || !waKey.trim() || !!busy} className={btn} style={{ background: BLUE }}>
                  {busy === "whatsapp:set" ? "Checking…" : "Save"}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
