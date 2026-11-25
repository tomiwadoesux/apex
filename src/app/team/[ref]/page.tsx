/* /team/<ref>?do=pay|confirm|cancel&sig=… — opened from a button under a
   Telegram booking alert. Shows the booking and a Send button that emails the
   guest (payment details, booking confirmed, or cancelled) from the no-reply
   address. Only links signed by the server work. Server component. */

import type { Metadata } from "next";
import { verifyAction, type TeamAction } from "@/lib/adminAuth";
import { getBooking } from "@/lib/bookings";
import { getSiteConfig } from "@/lib/siteConfig";
import { naira } from "@/lib/pricing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ApexRide team", robots: { index: false, follow: false } };

const COPY: Record<TeamAction, { title: string; button: string; done: string }> = {
  pay: { title: "Email payment details", button: "Send payment details", done: "Payment details sent" },
  confirm: { title: "Email booking confirmation", button: "Send confirmation", done: "Confirmation sent, booking marked paid and confirmed" },
  cancel: { title: "Email cancellation", button: "Cancel booking and email guest", done: "Cancellation sent, booking marked cancelled" },
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh w-full bg-slate-100 px-4 py-10 text-slate-900">
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 py-5 text-white" style={{ background: "linear-gradient(135deg,#2A4FD0,#00209C)" }}>
          <div className="text-lg font-semibold tracking-wide">ApexRide</div>
          <div className="text-xs opacity-75">Team action</div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </main>
  );
}

export default async function TeamActionPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { ref: rawRef } = await params;
  const ref = decodeURIComponent(rawRef);
  const q = await searchParams;
  const action = one(q.do);
  const sig = one(q.sig);

  if (!verifyAction(ref, action, sig)) {
    return (
      <Shell>
        <p className="font-semibold">Link not valid</p>
        <p className="mt-2 text-sm text-slate-600">Open this action from the button under the Telegram alert.</p>
      </Shell>
    );
  }

  const booking = await getBooking(ref);
  if (!booking) {
    return (
      <Shell>
        <p className="font-semibold">Booking {ref} not found</p>
      </Shell>
    );
  }

  const copy = COPY[action];
  const sent = one(q.sent) === "1";
  const error = one(q.error);
  const bank = action === "pay" ? (await getSiteConfig()).payment : null;
  const rows: [string, string | null | undefined][] = [
    ["Reference", booking.id],
    ["Guest", booking.passenger.name],
    ["Email", booking.passenger.email || "none given"],
    ["Phone", booking.passenger.phone],
    ["Car", booking.car.name],
    ["Service", booking.service],
    ["When", `${booking.date} at ${booking.time}`],
    ["Fare", booking.amount ? naira(booking.amount) : null],
    ["Status", `${booking.status ?? "new"}${booking.paid ? ", paid" : ""}`],
  ];

  return (
    <Shell>
      <h1 className="text-lg font-semibold">{copy.title}</h1>
      <table className="mt-4 w-full text-sm">
        <tbody>
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <tr key={k}>
                <td className="py-1 pr-4 align-top whitespace-nowrap text-slate-500">{k}</td>
                <td className="py-1">{v}</td>
              </tr>
            ))}
        </tbody>
      </table>

      {sent ? (
        <p className="mt-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✓ {copy.done}.</p>
      ) : !booking.passenger.email ? (
        <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This guest didn&apos;t give an email address. Use the WhatsApp button in Telegram instead.
        </p>
      ) : (
        <form method="post" action="/api/team-action" className="mt-6 space-y-4">
          <input type="hidden" name="ref" value={booking.id} />
          <input type="hidden" name="do" value={action} />
          <input type="hidden" name="sig" value={sig} />
          {action === "pay" && bank && (
            <>
              <label className="block text-sm font-medium">
                Amount to pay (₦)
                <input
                  name="amount"
                  inputMode="numeric"
                  required
                  defaultValue={booking.amount ? String(booking.amount) : ""}
                  placeholder="e.g. 150000"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base"
                />
              </label>
              <p className="text-xs text-slate-500">
                Sends {bank.bankName}, {bank.accountNumber}, {bank.accountName}. Change these in admin → Payment channel.
              </p>
            </>
          )}
          {action === "cancel" && (
            <label className="block text-sm font-medium">
              Reason (optional, included in the email)
              <input name="reason" maxLength={300} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base" />
            </label>
          )}
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
          <button
            type="submit"
            className={`w-full rounded-full px-5 py-3 text-sm font-semibold text-white ${action === "cancel" ? "bg-red-600" : "bg-[#2A4FD0]"}`}
          >
            {copy.button}
          </button>
          <p className="text-center text-xs text-slate-500">Emails {booking.passenger.email} from no-reply@apexriderental.com</p>
        </form>
      )}
    </Shell>
  );
}
