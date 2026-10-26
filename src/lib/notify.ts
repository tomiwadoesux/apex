// Booking notifications, sent right after a booking is saved:
//   • Resend email to the customer (when they gave an email) confirming the ride.
//   • Resend email to the company inbox (COMPANY_EMAIL) announcing the booking.
//   • ntfy.sh push to the team's phones (NTFY_TOPIC) — anyone with the free ntfy
//     app subscribed to the topic gets an instant lock-screen notification.
//   • Telegram message from the team's bot (TELEGRAM_BOT_TOKEN, made with
//     @BotFather) to every chat in TELEGRAM_CHAT_ID — comma separated, so it can
//     be you, a teammate or a group the bot was added to.
//   • WhatsApp message to your own number through CallMeBot's free API
//     (CALLMEBOT_PHONE + the CALLMEBOT_API_KEY their bot sends you).
//
// Every channel is optional: a missing env var just skips that channel, and a
// failed send never breaks the booking itself. Server-only.

import type { Booking, BookingInput } from "./bookings";
import { naira } from "./pricing";

const RESEND_KEY = process.env.RESEND_API_KEY;
// ayotomcs.me is the domain verified in Resend, so senders must live on it —
// not on the apex. subdomain. RESEND_FROM overrides if that ever changes.
const FROM = process.env.RESEND_FROM || "ApexRide <bookings@ayotomcs.me>";
// Where booking + payment alerts land — the ApexRide business inbox. Hard-wired
// (not from COMPANY_EMAIL) so a stale env var can't redirect them elsewhere.
const COMPANY_EMAIL = "apexrental08@gmail.com";
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const TELEGRAM_CHATS = (process.env.TELEGRAM_CHAT_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean);
// International format for CallMeBot; a local Nigerian 0… number gets +234.
const callmebotDigits = (process.env.CALLMEBOT_PHONE ?? "").replace(/\D/g, "").replace(/^0/, "234");
const WHATSAPP_PHONE = callmebotDigits ? `+${callmebotDigits}` : null;
const WHATSAPP_KEY = process.env.CALLMEBOT_API_KEY?.trim();
const telegramOn = Boolean(TELEGRAM_TOKEN && TELEGRAM_CHATS.length);
const whatsappOn = Boolean(WHATSAPP_PHONE && WHATSAPP_KEY);
const SITE_URL = process.env.SITE_URL || "https://apexriderental.com";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function rows(b: Booking): string {
  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:6px 14px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#0f172a;font-size:14px">${esc(value)}</td></tr>`
      : "";
  return [
    row("Reference", b.id),
    row("Passenger", b.passenger.name),
    row("Phone", b.passenger.phone),
    row("Car", `${b.car.name}${b.car.klass ? `, ${b.car.klass}` : ""}`),
    row("Service", b.service),
    row("Pickup", b.pickup),
    row("Destination", b.dropoff),
    row("Duration", b.duration),
    row("Date", `${b.date} at ${b.time}`),
    row("Payment note", b.paymentNote ?? null),
  ].join("");
}

function emailShell(heading: string, intro: string, b: Booking, cta?: { label: string; href: string }): string {
  return `<div style="font-family:Helvetica,Arial,sans-serif;background:#f6f7f9;padding:32px 16px">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
    <div style="background:linear-gradient(135deg,#2A4FD0,#00209C);padding:22px 26px">
      <div style="color:#ffffff;font-size:18px;font-weight:600;letter-spacing:.4px">ApexRide</div>
      <div style="color:rgba(255,255,255,.75);font-size:12px;margin-top:2px">Luxury chauffeur service</div>
    </div>
    <div style="padding:26px">
      <div style="color:#0f172a;font-size:17px;font-weight:600">${heading}</div>
      <p style="color:#475569;font-size:14px;line-height:1.6;margin:10px 0 18px">${intro}</p>
      <table style="border-collapse:collapse">${rows(b)}</table>
      ${cta ? `<a href="${cta.href}" style="display:inline-block;margin-top:20px;background:#2A4FD0;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:999px">${cta.label}</a>` : ""}
      <p style="color:#94a3b8;font-size:12px;margin:22px 0 0">Questions? Call or WhatsApp us on 0904 338 0193.</p>
    </div>
  </div>
</div>`;
}

type Attachment = { filename: string; content: string }; // content = base64 (no data-URL prefix)

async function sendEmail(to: string, subject: string, html: string, attachments?: Attachment[]): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, ...(attachments?.length ? { attachments } : {}) }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
}

// "data:image/png;base64,AAAA" → { filename, content: "AAAA" }, or null if it
// isn't a base64 image data URL we can attach.
function receiptAttachment(dataUrl: string | null | undefined, name: string | null | undefined): Attachment | null {
  if (!dataUrl) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const ext = m[1].split("/")[1].replace("jpeg", "jpg");
  return { filename: name || `receipt.${ext}`, content: m[2] };
}

async function sendPush(b: Booking): Promise<void> {
  const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      Title: `New booking ${b.id}`,
      Priority: "high",
      Tags: "oncoming_automobile",
    },
    body: `${b.passenger.name} (${b.passenger.phone})\n${b.car.name}, ${b.service}\n${b.pickup}\n${b.date} at ${b.time}`,
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}

async function sendPushText(title: string, body: string, tags = "money_with_wings"): Promise<void> {
  const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: { Title: title, Priority: "high", Tags: tags },
    body,
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}

/* ── Telegram + WhatsApp: the same short alert on both ─────────────────────── */

// The booking as labelled lines, empty fields left out.
function alertLines(b: Booking): [string, string][] {
  const lines: [string, string | null | undefined][] = [
    ["Passenger", b.passenger.name],
    ["Phone", b.passenger.phone],
    ["Email", b.passenger.email],
    ["Car", `${b.car.name}${b.car.klass ? `, ${b.car.klass}` : ""}`],
    ["Service", b.service],
    ["Pickup", b.pickup],
    ["Destination", b.dropoff],
    ["Duration", b.duration],
    ["When", `${b.date} at ${b.time}`],
    ["Fare", b.amount ? naira(b.amount) : null],
    ["Payment", b.paymentNote],
  ];
  return lines.filter((l): l is [string, string] => Boolean(l[1]));
}

function telegramAlert(title: string, b: Booking, note?: string): string {
  return [`<b>${esc(title)}</b>`, ...(note ? [esc(note)] : []), "", ...alertLines(b).map(([k, v]) => `<b>${k}:</b> ${esc(v)}`)].join("\n");
}

function whatsappAlert(title: string, b: Booking, note?: string): string {
  return [`*${title}*`, ...(note ? [note] : []), "", ...alertLines(b).map(([k, v]) => `${k}: ${v}`)].join("\n");
}

type TelegramButton = { text: string; url: string };

// One-tap actions under the Telegram alert: message the guest on WhatsApp, or
// open the admin panel. (Telegram only takes http(s) links on buttons.)
function telegramButtons(b: Booking): TelegramButton[] {
  const buttons: TelegramButton[] = [];
  const digits = b.passenger.phone.replace(/\D/g, "").replace(/^0/, "234");
  if (digits.length >= 10) buttons.push({ text: "💬 WhatsApp guest", url: `https://wa.me/${digits}` });
  if (SITE_URL.startsWith("https://")) buttons.push({ text: "Open admin", url: `${SITE_URL}/admin` });
  return buttons;
}

async function sendTelegram(html: string, buttons: TelegramButton[] = []): Promise<void> {
  const post = (chatId: string, withButtons: boolean) =>
    fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        ...(withButtons && buttons.length ? { reply_markup: { inline_keyboard: [buttons] } } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
  const sends = await Promise.allSettled(
    TELEGRAM_CHATS.map(async (chatId) => {
      let res = await post(chatId, true);
      // A button Telegram rejects mustn't cost the alert: resend without them.
      if (res.status === 400 && buttons.length) res = await post(chatId, false);
      if (!res.ok) {
        const why = ((await res.json().catch(() => null)) as { description?: string } | null)?.description;
        throw new Error(`Telegram ${res.status} for chat ${chatId}: ${why ?? "no reply"}`);
      }
    }),
  );
  const failed = sends.find((s): s is PromiseRejectedResult => s.status === "rejected");
  if (failed) throw failed.reason;
}

type TelegramChat = { id: number; title?: string; first_name?: string; last_name?: string; username?: string };

// Chats that messaged the bot recently (Telegram keeps ~24h of updates), as
// "id (name)", so Send test can show which id belongs in TELEGRAM_CHAT_ID.
async function telegramChatsSeen(): Promise<string[]> {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean;
    description?: string;
    result?: { message?: { chat: TelegramChat }; channel_post?: { chat: TelegramChat }; my_chat_member?: { chat: TelegramChat } }[];
  } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram ${res.status}: ${data?.description ?? "no reply"}${res.status === 401 || res.status === 404 ? ", check TELEGRAM_BOT_TOKEN" : ""}`);
  }
  const seen = new Map<number, string>();
  for (const u of data.result ?? []) {
    const chat = u.message?.chat ?? u.channel_post?.chat ?? u.my_chat_member?.chat;
    if (chat) seen.set(chat.id, chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || "");
  }
  return [...seen].map(([id, name]) => (name ? `${id} (${name})` : String(id)));
}

// CallMeBot answers with a short HTML page, returned here as plain text. It can
// answer 200 even for a bad key, so the reply itself is checked too.
async function sendWhatsApp(text: string): Promise<string> {
  const query = new URLSearchParams({ phone: WHATSAPP_PHONE ?? "", text, apikey: WHATSAPP_KEY ?? "" });
  const res = await fetch(`https://api.callmebot.com/whatsapp.php?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const reply = (await res.text().catch(() => "")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!res.ok || /invalid|need to get the api ?key/i.test(reply)) {
    throw new Error(`CallMeBot ${res.status}: ${reply.slice(0, 200) || "no reply"}`);
  }
  return reply;
}

// Telegram + WhatsApp sends for one alert, for whichever are configured.
function chatAlerts(title: string, b: Booking, note?: string): Promise<unknown>[] {
  const jobs: Promise<unknown>[] = [];
  if (telegramOn) jobs.push(sendTelegram(telegramAlert(title, b, note), telegramButtons(b)));
  if (whatsappOn) jobs.push(sendWhatsApp(whatsappAlert(title, b, note)));
  return jobs;
}

async function settle(jobs: Promise<unknown>[], what: string): Promise<void> {
  for (const r of await Promise.allSettled(jobs)) {
    if (r.status === "rejected") console.error(`[notify] ${what} send failed`, r.reason);
  }
}

// Which channels the server actually has configured — surfaced in /admin so a
// missing env var is visible instead of a silent skip.
export function notificationStatus() {
  return {
    resend: Boolean(RESEND_KEY),
    companyEmail: COMPANY_EMAIL || null,
    from: FROM,
    ntfyTopic: NTFY_TOPIC || null,
    telegramBot: Boolean(TELEGRAM_TOKEN),
    telegramChats: TELEGRAM_CHATS.length,
    whatsappTo: WHATSAPP_PHONE,
    whatsappKey: Boolean(WHATSAPP_KEY),
    supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

// Fires every configured channel with a test message and reports exactly what
// happened on each — the /admin "Send test" button.
export async function sendTestNotifications(): Promise<{ channel: string; ok: boolean; detail: string }[]> {
  const results: { channel: string; ok: boolean; detail: string }[] = [];
  const fake: Booking = {
    id: "APX-TEST00",
    createdAt: Date.now(),
    passenger: { name: "Test Passenger", phone: "+2340000000000", email: "" },
    car: { name: "Test Car", klass: "Test", image: null },
    service: "Notification test",
    pickup: "Admin panel",
    dropoff: null,
    duration: null,
    date: "today",
    time: "now",
    light: true,
  };
  if (!RESEND_KEY) {
    results.push({ channel: "email", ok: false, detail: "RESEND_API_KEY is not set" });
  } else if (!COMPANY_EMAIL) {
    results.push({ channel: "email", ok: false, detail: "COMPANY_EMAIL is not set" });
  } else {
    try {
      await sendEmail(COMPANY_EMAIL, "ApexRide test notification", emailShell("Test notification", "If you can read this, booking emails are working.", fake));
      results.push({ channel: "email", ok: true, detail: `sent to ${COMPANY_EMAIL} from ${FROM}` });
    } catch (e) {
      results.push({ channel: "email", ok: false, detail: String(e).slice(0, 300) });
    }
  }
  if (!NTFY_TOPIC) {
    results.push({ channel: "push", ok: false, detail: "NTFY_TOPIC is not set" });
  } else {
    try {
      await sendPush(fake);
      results.push({ channel: "push", ok: true, detail: `pushed to ntfy.sh/${NTFY_TOPIC}` });
    } catch (e) {
      results.push({ channel: "push", ok: false, detail: String(e).slice(0, 300) });
    }
  }
  if (!TELEGRAM_TOKEN) {
    results.push({ channel: "telegram", ok: false, detail: "TELEGRAM_BOT_TOKEN is not set" });
  } else if (!TELEGRAM_CHATS.length) {
    // No chat yet: list who has messaged the bot, so the right id can be copied.
    try {
      const chats = await telegramChatsSeen();
      results.push({
        channel: "telegram",
        ok: false,
        detail: chats.length
          ? `TELEGRAM_CHAT_ID is not set. Chats that messaged your bot: ${chats.join(", ")}. Put the number in TELEGRAM_CHAT_ID.`
          : "TELEGRAM_CHAT_ID is not set. Send your bot any message in Telegram, then press Send test again to see your chat id.",
      });
    } catch (e) {
      results.push({ channel: "telegram", ok: false, detail: String(e).slice(0, 300) });
    }
  } else {
    try {
      await sendTelegram(telegramAlert("✅ ApexRide test notification", fake, "If you can read this, Telegram booking alerts are working."), telegramButtons(fake));
      results.push({ channel: "telegram", ok: true, detail: `sent to ${TELEGRAM_CHATS.length} chat${TELEGRAM_CHATS.length > 1 ? "s" : ""}` });
    } catch (e) {
      results.push({ channel: "telegram", ok: false, detail: String(e).slice(0, 300) });
    }
  }
  if (!whatsappOn) {
    results.push({ channel: "whatsapp", ok: false, detail: `${WHATSAPP_PHONE ? "CALLMEBOT_API_KEY" : "CALLMEBOT_PHONE"} is not set` });
  } else {
    try {
      const reply = await sendWhatsApp(whatsappAlert("✅ ApexRide test notification", fake, "If you can read this, WhatsApp booking alerts are working."));
      results.push({ channel: "whatsapp", ok: true, detail: `sent to ${WHATSAPP_PHONE}, CallMeBot replied: ${reply.slice(0, 160) || "OK"}` });
    } catch (e) {
      results.push({ channel: "whatsapp", ok: false, detail: String(e).slice(0, 300) });
    }
  }
  return results;
}

export async function notifyBookingCreated(
  b: Booking,
  extras?: { receipt?: string | null; receiptName?: string | null },
): Promise<void> {
  if (!RESEND_KEY && !NTFY_TOPIC && !telegramOn && !whatsappOn) {
    console.warn("[notify] skipped, no notification channel configured");
    return;
  }
  const jobs: Promise<unknown>[] = [];
  const receipt = receiptAttachment(extras?.receipt, extras?.receiptName);

  if (RESEND_KEY && b.passenger.email) {
    jobs.push(
      sendEmail(
        b.passenger.email,
        `Your ApexRide booking ${b.id}`,
        emailShell(
          "Your ride is booked",
          `Thank you${b.passenger.name ? `, ${esc(b.passenger.name)}` : ""}. We've received your booking, our team will reach out shortly to confirm the details below. Your work order ID is <strong>${esc(b.id)}</strong>; keep it to track your booking anytime.`,
          b,
          { label: "Check your booking", href: `${SITE_URL}/check-booking?ref=${encodeURIComponent(b.id)}` },
        ),
      ),
    );
  }

  if (RESEND_KEY && COMPANY_EMAIL) {
    jobs.push(
      sendEmail(
        COMPANY_EMAIL,
        `New booking ${b.id}, ${b.passenger.name || "unknown"}`,
        emailShell(
          "Someone just booked a ride",
          receipt
            ? "A new booking has come in with a payment receipt attached. Review it and assign a driver in the admin panel."
            : "A new booking has come in. Review it and assign a driver in the admin panel.",
          b,
        ),
        receipt ? [receipt] : undefined,
      ),
    );
  }

  if (NTFY_TOPIC) jobs.push(sendPush(b));
  jobs.push(...chatAlerts(`🚘 New booking ${b.id}`, b));

  await settle(jobs, "booking");
}

// Fired when the guest submits their transfer receipt for an existing booking.
// Emails the team the receipt + payment note and pushes a heads-up.
export async function notifyPaymentReceived(
  b: Booking,
  extras?: { receipt?: string | null; receiptName?: string | null },
): Promise<void> {
  if (!RESEND_KEY && !NTFY_TOPIC && !telegramOn && !whatsappOn) return;
  const jobs: Promise<unknown>[] = [];
  const receipt = receiptAttachment(extras?.receipt, extras?.receiptName);

  if (RESEND_KEY && COMPANY_EMAIL) {
    jobs.push(
      sendEmail(
        COMPANY_EMAIL,
        `Payment submitted, ${b.id}, ${b.passenger.name || "unknown"}`,
        emailShell(
          "Payment received",
          receipt
            ? `The guest has transferred the fare for booking ${esc(b.id)} and attached their receipt (below). Confirm it, then mark the booking paid.`
            : `Payment has come in for booking ${esc(b.id)}. The details are below, mark the booking paid and let the guest know.`,
          b,
        ),
        receipt ? [receipt] : undefined,
      ),
    );
  }

  if (NTFY_TOPIC) {
    jobs.push(
      sendPushText(
        `Payment received, ${b.id}`,
        `${b.passenger.name || "A guest"} submitted a receipt.\n${b.paymentNote || ""}`.trim(),
      ),
    );
  }
  jobs.push(...chatAlerts(`💸 Payment received, ${b.id}`, b));

  await settle(jobs, "payment");
}

// Saving failed (e.g. the database is down), yet the form still shows the guest
// a pass with a temporary reference. Alert the team so the ride isn't lost; it
// won't be in /admin, so the guest has to be contacted directly.
export async function notifyBookingUnsaved(
  input: BookingInput,
  extras?: { receipt?: string | null; receiptName?: string | null },
): Promise<void> {
  const b: Booking = { ...input, id: "NOT SAVED", createdAt: Date.now() };
  const note =
    "The database didn't respond, so this booking isn't in the admin panel, but the guest was shown a confirmation. Contact them to confirm the ride.";
  const jobs: Promise<unknown>[] = [];
  const receipt = receiptAttachment(extras?.receipt, extras?.receiptName);

  if (RESEND_KEY && COMPANY_EMAIL) {
    jobs.push(
      sendEmail(
        COMPANY_EMAIL,
        `Booking NOT saved, ${b.passenger.name || "unknown"}`,
        emailShell("A booking couldn't be saved", note, b),
        receipt ? [receipt] : undefined,
      ),
    );
  }
  if (NTFY_TOPIC) {
    jobs.push(
      sendPushText(
        "Booking NOT saved",
        `${b.passenger.name} (${b.passenger.phone})\n${b.car.name}, ${b.service}\n${b.pickup}\n${b.date} at ${b.time}`,
        "warning",
      ),
    );
  }
  jobs.push(...chatAlerts("⚠️ Booking NOT saved", b, note));

  await settle(jobs, "unsaved booking");
}
