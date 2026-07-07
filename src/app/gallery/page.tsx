// The fleet gallery — a visual index of the whole library. It scans, at request
// time, both the loose lineup shots in public/images/fleet AND the per-car
// folders in public/images/cars & public/images/buses, so any new image you drop
// into those folders shows up here automatically (no code change needed).
//
// Server component: it touches the filesystem, so it can't be a client component.

import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic"; // always reflect the current folder contents

const ACCENT = "#2A4FD0";

type Car = { name: string; images: string[] };

// The angle we'd rather show first on each card.
const ORDER = ["front", "side", "rear", "back"];
const rank = (file: string) => {
  const i = ORDER.findIndex((a) => file.toLowerCase().includes(a));
  return i === -1 ? ORDER.length : i;
};

// Loose lineup shots that sit DIRECTLY in public/images/fleet. In light mode we
// prefer the *_light_* variants; if none exist we fall back to whatever's there.
async function scanFleet(): Promise<{ src: string; label: string }[]> {
  const base = path.join(process.cwd(), "public", "images", "fleet");
  let files: string[];
  try {
    files = await fs.readdir(base);
  } catch {
    return [];
  }
  const webp = files.filter((f) => f.toLowerCase().endsWith(".webp"));
  const light = webp.filter((f) => f.toLowerCase().includes("light"));
  const chosen = (light.length ? light : webp).sort();
  return chosen.map((f) => {
    const stem = f.replace(/\.webp$/i, "");
    // "fleet1_light_front" → "Fleet 1 · Front"
    const label = stem
      .replace(/_light_|_dark_/gi, " ")
      .replace(/fleet\s*(\d+)/i, "Fleet $1")
      .replace(/front/i, "· Front")
      .replace(/back|rear/i, "· Rear")
      .replace(/\s+/g, " ")
      .trim();
    return { src: `/images/fleet/${encodeURIComponent(f)}`, label };
  });
}

// Loose beauty shots dropped straight into public/images/gallery — the brand
// photoshoot. Shown as a mixed-orientation masonry (portrait/landscape/square
// all keep their natural shape).
async function scanGallery(): Promise<string[]> {
  const base = path.join(process.cwd(), "public", "images", "gallery");
  let files: string[];
  try {
    files = await fs.readdir(base);
  } catch {
    return [];
  }
  return files
    .filter((f) => /\.(webp|jpe?g|png)$/i.test(f))
    .sort()
    .map((f) => `/images/gallery/${encodeURIComponent(f)}`);
}

// Per-car folders (public/images/cars, public/images/buses).
async function scan(dir: string): Promise<Car[]> {
  const base = path.join(process.cwd(), "public", "images", dir);
  let entries: string[];
  try {
    entries = await fs.readdir(base);
  } catch {
    return [];
  }
  const cars: Car[] = [];
  for (const name of entries) {
    if (name.startsWith("_") || name.startsWith(".") || name.toLowerCase() === "duplicates") continue;
    const full = path.join(base, name);
    let stat;
    try {
      stat = await fs.stat(full);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const files = (await fs.readdir(full))
      .filter((f) => f.toLowerCase().endsWith(".webp"))
      .sort((a, b) => rank(a) - rank(b))
      .map((f) => `/images/${dir}/${encodeURIComponent(name)}/${encodeURIComponent(f)}`);
    if (files.length === 0) continue;
    cars.push({ name, images: files });
  }
  return cars.sort((a, b) => a.name.localeCompare(b.name));
}

export default async function GalleryPage() {
  const [shots, fleet, cars, buses] = await Promise.all([scanGallery(), scanFleet(), scan("cars"), scan("buses")]);
  const groups = [
    { label: "Cars", items: cars },
    { label: "Buses & vans", items: buses },
  ].filter((g) => g.items.length > 0);
  const total = cars.length + buses.length;

  return (
    <main className="min-h-dvh bg-[#f4f6fb] text-neutral-900">
      {/* soft brand spotlight so the light canvas isn't flat */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(70% 45% at 50% -6%, rgba(42,79,208,0.10), transparent 60%)" }} />

      {/* header — logo home + back to fleet */}
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} color="#0b0d12" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em]">
            Apex<span className="font-semibold" style={{ color: ACCENT }}>Ride</span>
          </span>
        </Link>
        <Link
          href="/fleet"
          className="rounded-full border border-neutral-900/15 bg-white px-5 py-2 text-sm font-semibold tracking-wide transition-colors hover:bg-neutral-900/[0.04]"
        >
          ← Back to fleet
        </Link>
      </header>

      {/* title */}
      <div className="relative z-10 px-5 pt-4 text-center sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-neutral-400">The collection</p>
        <h1 className="mt-2 font-josefin text-4xl font-light leading-none tracking-tight sm:text-6xl">Gallery</h1>
        <p className="mt-3 text-sm text-neutral-500">The full ApexRide lineup — every angle in our library</p>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-12 sm:px-10">
        {/* MASONRY — the brand photoshoot. CSS columns let each photo keep its
            natural shape (portrait / landscape / square) and pack together. */}
        {shots.length > 0 && (
          <section className="mb-16">
            <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 [column-fill:balance]">
              {shots.map((src) => (
                <figure
                  key={src}
                  className="group mb-3 break-inside-avoid overflow-hidden rounded-2xl border border-neutral-900/[0.08] bg-white shadow-[0_12px_36px_-22px_rgba(15,23,42,0.28)] sm:mb-4"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt="ApexRide"
                    loading="lazy"
                    className="w-full transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* FEATURED — the fleet lineup shots from the fleet folder */}
        {fleet.length > 0 && (
          <section className="mb-14">
            <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">The fleet</h2>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {fleet.map((f) => (
                <figure
                  key={f.src}
                  className="group relative overflow-hidden rounded-3xl border border-neutral-900/[0.08] bg-white shadow-[0_18px_50px_-24px_rgba(15,23,42,0.25)]"
                >
                  <div className="relative aspect-[16/9] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.src}
                      alt={f.label}
                      loading="lazy"
                      className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <figcaption className="border-t border-neutral-900/[0.06] px-5 py-3.5 text-sm font-semibold tracking-tight">
                    {f.label}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        )}

        {/* per-car groups */}
        {groups.map((g) => (
          <section key={g.label} className="mb-14">
            <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">{g.label}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((car) => (
                <figure
                  key={car.name}
                  className="group relative overflow-hidden rounded-2xl border border-neutral-900/[0.08] bg-white shadow-[0_12px_36px_-20px_rgba(15,23,42,0.22)]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={car.images[0]}
                      alt={car.name}
                      loading="lazy"
                      className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                    {car.images.length > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-neutral-900/70 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white backdrop-blur-sm">
                        {car.images.length} photos
                      </span>
                    )}
                  </div>
                  <figcaption className="border-t border-neutral-900/[0.06] px-3.5 py-3">
                    <div className="truncate text-sm font-semibold tracking-tight">{car.name}</div>
                    <Link
                      href={`/form?car=${encodeURIComponent(car.name)}`}
                      className="mt-1 inline-block text-[11px] font-semibold tracking-wide"
                      style={{ color: ACCENT }}
                    >
                      Book this →
                    </Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}

        {fleet.length === 0 && total === 0 && (
          <p className="py-20 text-center text-sm text-neutral-400">No vehicles in the library yet.</p>
        )}
      </div>
    </main>
  );
}
