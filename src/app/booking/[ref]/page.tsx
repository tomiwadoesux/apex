/* The page a scanned ride-pass QR lands on: it shows the booking reference for
   the number encoded in the QR (/booking/<digits>). Server component — the ref
   comes in via the async `params` prop (Next 16 convention). */

import Link from "next/link";

const AMBER = "#FDBA16";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const digits = ref.replace(/\D/g, "");
  const pretty = digits.replace(/(\d{4})(?=\d)/g, "$1 ") || ref;

  return (
    <main
      className="grid min-h-dvh w-full place-items-center px-6 py-16"
      style={{ background: "radial-gradient(130% 120% at 50% -10%, #14171e 0%, #0a0c10 65%, #06070a 100%)", color: "#eef1f6" }}
    >
      <div
        className="w-full max-w-md rounded-3xl border p-8 text-center"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)", backdropFilter: "blur(8px)" }}
      >
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <svg width="22" height="24" viewBox="0 0 139 152" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M66.7703 0C74.2372 0.18897 76.7497 3.24329 80.4577 9.45514C96.9025 37.0697 113.133 64.7208 129.466 92.4111C132.151 96.9622 139.831 108.081 138.677 113.593C138.253 115.617 136.012 120.237 134.195 120.71C116.289 125.374 88.0411 98.6954 72.0326 94.5106L71.1219 94.2792C53.5024 94.4998 25.6138 124.146 7.85784 122.039C5.40108 121.748 3.01758 120.715 1.57899 118.62C0.14955 116.539 -0.25924 113.594 0.151192 111.127C1.14272 105.174 52.8722 16.4895 59.8853 6.52736C61.8259 3.7719 64.0013 1.89386 66.7703 0Z" fill={AMBER} />
            <path d="M65.4483 103.057C78.6429 100.845 91.1706 109.627 93.5891 122.784C96.0076 135.941 87.4218 148.605 74.3037 151.23C65.6331 152.964 56.7001 149.891 50.9324 143.189C45.1639 136.487 43.4564 127.196 46.4643 118.882C49.4713 110.567 56.7276 104.518 65.4483 103.057Z" fill={AMBER} />
          </svg>
          <span className="text-sm font-semibold tracking-[0.22em]">APEX</span>
        </div>

        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: "rgba(253,186,22,0.12)", color: AMBER }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
          BOOKING CONFIRMED
        </span>

        <div className="mt-5 text-[11px] font-semibold tracking-[0.3em]" style={{ color: "rgba(255,255,255,.5)" }}>
          BOOKING REFERENCE
        </div>
        <div className="mt-2 font-semibold tabular-nums" style={{ fontSize: "2rem", letterSpacing: "0.14em" }}>
          {pretty}
        </div>

        <p className="mt-5 text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.6)" }}>
          Your Apex ride is confirmed. Keep this reference handy — your chauffeur will use it at pickup.
        </p>

        <Link href="/holo-card" className="mt-7 inline-block rounded-full px-5 py-2 text-xs font-semibold" style={{ background: AMBER, color: "#15161a" }}>
          View ride pass
        </Link>
      </div>
    </main>
  );
}
