// Booking notifications, sent right after a booking is saved:
//   • Resend email to the customer (when they gave an email) confirming the ride.
//   • Resend email to the company inbox (COMPANY_EMAIL) announcing the booking.
//   • ntfy.sh push to the team's phones (NTFY_TOPIC) — anyone with the free ntfy
//     app subscribed to the topic gets an instant lock-screen notification.
//
// Every channel is optional: a missing env var just skips that channel, and a
// failed send never breaks the booking itself. Server-only.

import type { Booking } from "./bookings";

const RESEND_KEY = process.env.RESEND_API_KEY;
// apex.ayotomcs.me must be verified as a domain in the Resend dashboard for
// this sender to deliver; RESEND_FROM overrides it if that ever changes.
const FROM = process.env.RESEND_FROM || "ApexRide <bookings@apex.ayotomcs.me>";
const COMPANY_EMAIL = process.env.COMPANY_EMAIL;
const NTFY_TOPIC = process.env.NTFY_TOPIC;
const SITE_URL = process.env.SITE_URL || "https://apex.ayotomcs.me";

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
    row("Car", `${b.car.name}${b.car.klass ? ` — ${b.car.klass}` : ""}`),
    row("Service", b.service),
    row("Pickup", b.pickup),
    row("Destination", b.dropoff),
    row("Duration", b.duration),
    row("Date", `${b.date} at ${b.time}`),
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
      <p style="color:#94a3b8;font-size:12px;margin:22px 0 0">Questions? Call or WhatsApp us on +234 814 168 1273.</p>
    </div>
  </div>
</div>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text().catch(() => "")}`);
}

async function sendPush(b: Booking): Promise<void> {
  const res = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: "POST",
    headers: {
      Title: `New booking ${b.id}`,
      Priority: "high",
      Tags: "oncoming_automobile",
    },
    body: `${b.passenger.name} (${b.passenger.phone})\n${b.car.name} — ${b.service}\n${b.pickup}\n${b.date} at ${b.time}`,
  });
  if (!res.ok) throw new Error(`ntfy ${res.status}`);
}

// Which channels the server actually has configured — surfaced in /admin so a
// missing env var is visible instead of a silent skip.
export function notificationStatus() {
  return {
    resend: Boolean(RESEND_KEY),
    companyEmail: COMPANY_EMAIL || null,
    from: FROM,
    ntfyTopic: NTFY_TOPIC || null,
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
  return results;
}

export async function notifyBookingCreated(b: Booking): Promise<void> {
  if (!RESEND_KEY && !NTFY_TOPIC) {
    console.warn("[notify] skipped — no RESEND_API_KEY or NTFY_TOPIC configured");
    return;
  }
  const jobs: Promise<void>[] = [];

  if (RESEND_KEY && b.passenger.email) {
    jobs.push(
      sendEmail(
        b.passenger.email,
        `Your ApexRide booking ${b.id}`,
        emailShell(
          "Your ride is booked",
          `Thank you${b.passenger.name ? `, ${esc(b.passenger.name)}` : ""}. We've received your booking — our team will reach out shortly to confirm the details below.`,
          b,
          { label: "View your booking", href: `${SITE_URL}/booking/${b.id.replace(/\D/g, "")}` },
        ),
      ),
    );
  }

  if (RESEND_KEY && COMPANY_EMAIL) {
    jobs.push(
      sendEmail(
        COMPANY_EMAIL,
        `New booking ${b.id} — ${b.passenger.name || "unknown"}`,
        emailShell("Someone just booked a ride", "A new booking has come in. Review it and assign a driver in the admin panel.", b),
      ),
    );
  }

  if (NTFY_TOPIC) jobs.push(sendPush(b));

  const results = await Promise.allSettled(jobs);
  for (const r of results) {
    if (r.status === "rejected") console.error("[notify] send failed", r.reason);
  }
}
