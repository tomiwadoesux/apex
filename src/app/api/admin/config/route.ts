import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { getSiteConfig, setSiteConfig } from "@/lib/siteConfig";
import { DEFAULT_CONFIG, type SiteConfig } from "@/lib/siteConfigDefaults";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await getSiteConfig(), { headers: { "Cache-Control": "no-store" } });
}

// PUT — replace the editable options. Shape-checked field by field; anything
// missing falls back to the current value so partial saves are safe.
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Partial<SiteConfig> | null;
  if (!body) return NextResponse.json({ error: "Bad body" }, { status: 400 });
  const current = await getSiteConfig();
  const str = (v: unknown, max = 200) => String(v ?? "").slice(0, max);
  const next: SiteConfig = {
    popularPickups: Array.isArray(body.popularPickups)
      ? body.popularPickups.slice(0, 12).map((p) => ({ city: str(p?.city, 40), name: str(p?.name) }))
      : current.popularPickups,
    durations: Array.isArray(body.durations)
      ? DEFAULT_CONFIG.durations.map((d) => {
          const e = body.durations!.find((x) => x?.id === d.id);
          return e
            ? { ...d, name: str(e.name, 60) || d.name, desc: str(e.desc, 240) || d.desc, ...(d.id !== "multiday" ? { hours: Number(e.hours) > 0 ? Number(e.hours) : d.hours } : {}) }
            : d;
        })
      : current.durations,
    tripTypes: Array.isArray(body.tripTypes)
      ? DEFAULT_CONFIG.tripTypes.map((t) => {
          const e = body.tripTypes!.find((x) => x?.id === t.id);
          return e ? { ...t, name: str(e.name, 60) || t.name, desc: str(e.desc, 240) || t.desc } : t;
        })
      : current.tripTypes,
    quickRequests: Array.isArray(body.quickRequests)
      ? body.quickRequests.map((q) => str(q, 80)).filter(Boolean).slice(0, 12)
      : current.quickRequests,
    extraCars: Array.isArray(body.extraCars)
      ? body.extraCars.slice(0, 40).map((c) => ({
          id: str(c?.id, 40) || `car-${Math.random().toString(36).slice(2, 8)}`,
          name: str(c?.name, 80),
          year: str(c?.year, 8),
          type: str(c?.type, 60),
          specs: Array.isArray(c?.specs) ? c.specs.map((s) => str(s, 40)).filter(Boolean).slice(0, 6) : [],
          image: c?.image ? str(c.image, 200) : null,
        })).filter((c) => c.name)
      : current.extraCars,
    hiddenCars: Array.isArray(body.hiddenCars)
      ? body.hiddenCars.map((n) => str(n, 80)).filter(Boolean)
      : current.hiddenCars,
    quickCars: Array.isArray(body.quickCars)
      ? body.quickCars.map((n) => str(n, 40)).filter(Boolean).slice(0, 40)
      : current.quickCars,
    carRates:
      body.carRates && typeof body.carRates === "object" && !Array.isArray(body.carRates)
        ? Object.fromEntries(
            Object.entries(body.carRates as Record<string, unknown>)
              .map(([k, v]) => [str(k, 40), Math.max(0, Math.min(1_000_000_000, Math.round(Number(v) || 0)))] as const)
              .filter(([k, v]) => k && v > 0),
          )
        : current.carRates,
    payment:
      body.payment && typeof body.payment === "object"
        ? {
            bankName: str(body.payment.bankName, 80) || current.payment.bankName,
            accountNumber: str(body.payment.accountNumber, 40) || current.payment.accountNumber,
            accountName: str(body.payment.accountName, 80) || current.payment.accountName,
          }
        : current.payment,
  };
  await setSiteConfig(next);
  return NextResponse.json(next);
}
