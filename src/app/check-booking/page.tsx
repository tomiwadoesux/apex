"use client";

/* Look up a saved booking by its reference and show that person's ride-pass card.
   The card image (if the car has one) is pulled from the site. */

import { useRef, useState } from "react";
import Link from "next/link";
import { toPng } from "html-to-image";
import { RidePass, type RideBooking } from "@/components/RideCard";
import type { Booking } from "@/lib/bookings";

const AMBER = "#FDBA16";

function toRide(b: Booking): RideBooking {
  return {
    service: b.service,
    pickup: b.pickup,
    dropoff: b.dropoff,
    duration: b.duration,
    date: b.date,
    time: b.time,
    bookingRef: b.id,
    car: { name: b.car.name, klass: b.car.klass, side: { light: b.car.image ?? "", dark: b.car.image ?? "" } },
    passengerName: b.passenger.name || undefined,
    phone: b.passenger.phone || undefined,
    email: b.passenger.email || undefined,
  };
}

type Status = "idle" | "loading" | "found" | "notfound" | "error";

export default function CheckBookingPage() {
  const [ref, setRef] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const search = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = ref.trim();
    if (!q || status === "loading") return;
    setStatus("loading");
    setBooking(null);
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(q)}`, { cache: "no-store" });
      if (res.status === 404) {
        setStatus("notfound");
        return;
      }
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = await res.json();
      setBooking(data.booking as Booking);
      setStatus("found");
    } catch {
      setStatus("error");
    }
  };

  const saveCard = async () => {
    const node = cardRef.current?.querySelector("[data-ride-card]") as HTMLElement | null;
    if (!node || !booking || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const fileName = `apexride-pass-${booking.id.replace(/[^a-z0-9]/gi, "")}.png`;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "ApexRide pass", text: `Booking ${booking.id}` });
          return;
        }
      } catch {
        /* sharing unavailable — fall through to a download */
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch (err) {
      console.error("card export failed", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main
      className="min-h-dvh w-full px-5 py-14 sm:py-20"
      style={{ background: "radial-gradient(130% 120% at 50% -10%, #14171e 0%, #0a0c10 65%, #06070a 100%)", color: "#eef1f6" }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-col items-center text-center">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.22em]">
          <svg width="20" height="22" viewBox="0 0 139 152" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M66.7703 0C74.2372 0.18897 76.7497 3.24329 80.4577 9.45514C96.9025 37.0697 113.133 64.7208 129.466 92.4111C132.151 96.9622 139.831 108.081 138.677 113.593C138.253 115.617 136.012 120.237 134.195 120.71C116.289 125.374 88.0411 98.6954 72.0326 94.5106L71.1219 94.2792C53.5024 94.4998 25.6138 124.146 7.85784 122.039C5.40108 121.748 3.01758 120.715 1.57899 118.62C0.14955 116.539 -0.25924 113.594 0.151192 111.127C1.14272 105.174 52.8722 16.4895 59.8853 6.52736C61.8259 3.7719 64.0013 1.89386 66.7703 0Z" fill={AMBER} />
            <path d="M65.4483 103.057C78.6429 100.845 91.1706 109.627 93.5891 122.784C96.0076 135.941 87.4218 148.605 74.3037 151.23C65.6331 152.964 56.7001 149.891 50.9324 143.189C45.1639 136.487 43.4564 127.196 46.4643 118.882C49.4713 110.567 56.7276 104.518 65.4483 103.057Z" fill={AMBER} />
          </svg>
          APEX
        </Link>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find your ride pass</h1>
        <p className="mt-2 text-sm text-white/55">Enter your booking number to pull up your card.</p>

        <form onSubmit={search} className="mt-6 flex w-full items-center gap-2">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="e.g. APX-482719"
            inputMode="text"
            autoCapitalize="characters"
            className="h-12 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 text-sm tracking-wide outline-none transition-colors placeholder:text-white/30 focus:border-[#FDBA16]"
          />
          <button
            type="submit"
            disabled={status === "loading" || !ref.trim()}
            className="h-12 shrink-0 rounded-xl bg-[#FDBA16] px-6 text-[11px] font-bold uppercase tracking-widest text-neutral-950 transition-colors hover:bg-[#e5a912] disabled:opacity-50"
          >
            {status === "loading" ? "…" : "Find"}
          </button>
        </form>

        {status === "notfound" && (
          <p className="mt-6 text-sm text-white/55">
            No booking found for “{ref.trim()}”. Double-check the number and try again.
          </p>
        )}
        {status === "error" && (
          <p className="mt-6 text-sm text-white/55">Something went wrong looking that up. Please try again.</p>
        )}

        {status === "found" && booking && (
          <div className="mt-4 flex w-full flex-col items-center">
            <div ref={cardRef} className="flex w-full justify-center">
              <RidePass booking={toRide(booking)} light={booking.light} />
            </div>
            <button
              type="button"
              onClick={saveCard}
              disabled={saving}
              className="-mt-1 rounded-full bg-[#FDBA16] px-7 py-3 text-[11px] font-bold uppercase tracking-widest text-neutral-950 transition-colors hover:bg-[#e5a912] disabled:opacity-60"
            >
              {saving ? "Preparing…" : "Save card to photos"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
