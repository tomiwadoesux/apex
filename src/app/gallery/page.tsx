// The fleet gallery — a visual index of every car in the photo library. It scans
// public/images/cars and public/images/buses at request time, so any new car
// folder you drop in shows up here automatically (no code change needed).
//
// Server component: it touches the filesystem, so it can't be a client component.

import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import Logo from "@/components/Logo";

export const dynamic = "force-dynamic"; // always reflect the current folder contents

const ACCENT = "#2A4FD0";

type Car = { name: string; category: string; images: string[] };

// The angle we'd rather show first on each card.
const ORDER = ["front", "side", "rear", "back"];
const rank = (file: string) => {
  const i = ORDER.findIndex((a) => file.toLowerCase().includes(a));
  return i === -1 ? ORDER.length : i;
};

async function scan(dir: string, category: string): Promise<Car[]> {
  const base = path.join(process.cwd(), "public", "images", dir);
  let entries: string[];
  try {
    entries = await fs.readdir(base);
  } catch {
    return [];
  }
  const cars: Car[] = [];
  for (const name of entries) {
    // skip helper/backup folders and anything hidden
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
    if (files.length === 0) continue; // an empty folder isn't a car yet
    cars.push({ name, category, images: files });
  }
  return cars.sort((a, b) => a.name.localeCompare(b.name));
}

export default async function GalleryPage() {
  const [cars, buses] = await Promise.all([scan("cars", "Cars"), scan("buses", "Buses")]);
  const groups = [
    { label: "Cars", items: cars },
    { label: "Buses & vans", items: buses },
  ].filter((g) => g.items.length > 0);
  const total = cars.length + buses.length;

  return (
    <main className="min-h-dvh bg-[#0b0d12] text-white">
      {/* header — logo home + back to fleet */}
      <header className="flex items-center justify-between px-5 py-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={30} color="#f3f5fa" accent={ACCENT} />
          <span className="text-sm font-bold uppercase tracking-[0.08em]">
            Apex<span className="font-semibold" style={{ color: "#8aa2ff" }}>Ride</span>
          </span>
        </Link>
        <Link
          href="/fleet"
          className="rounded-full border border-white/15 bg-white/5 px-5 py-2 text-sm font-semibold tracking-wide transition-colors hover:bg-white/10"
        >
          ← Back to fleet
        </Link>
      </header>

      {/* title */}
      <div className="px-5 pt-4 text-center sm:px-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">The collection</p>
        <h1 className="mt-2 font-josefin text-4xl font-light leading-none tracking-tight sm:text-6xl">Gallery</h1>
        <p className="mt-3 text-sm text-white/55">{total} vehicles · every angle in our library</p>
      </div>

      {/* groups */}
      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-10">
        {groups.map((g) => (
          <section key={g.label} className="mb-14">
            <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.22em] text-white/40">{g.label}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {g.items.map((car) => (
                <figure
                  key={`${car.category}-${car.name}`}
                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"
                >
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {/* plain img — no next/image optimizer needed for a static gallery */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={car.images[0]}
                      alt={car.name}
                      loading="lazy"
                      className="h-full w-full object-contain p-2 transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                    {car.images.length > 1 && (
                      <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/85 backdrop-blur-sm">
                        {car.images.length} photos
                      </span>
                    )}
                  </div>
                  <figcaption className="border-t border-white/[0.06] px-3.5 py-3">
                    <div className="truncate text-sm font-semibold tracking-tight">{car.name}</div>
                    <Link
                      href={`/form?car=${encodeURIComponent(car.name)}`}
                      className="mt-1 inline-block text-[11px] font-semibold tracking-wide"
                      style={{ color: "#8aa2ff" }}
                    >
                      Book this →
                    </Link>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}

        {total === 0 && <p className="py-20 text-center text-sm text-white/40">No vehicles in the library yet.</p>}
      </div>
    </main>
  );
}
