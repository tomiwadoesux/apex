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
import Masonry from "./Masonry";

export const dynamic = "force-dynamic"; // always reflect the current folder contents

const ACCENT = "#2A4FD0";

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


export default async function GalleryPage() {
  const [shots, fleet] = await Promise.all([scanGallery(), scanFleet()]);
  // One unified photo wall: the brand photoshoot first, then the fleet lineup
  // shots folded in — all real photography, all in the same masonry + lightbox.
  const all = [...shots, ...fleet.map((f) => f.src)];

  return (
    <main className="min-h-dvh bg-[#f4f6fb] text-neutral-900">
      {/* soft brand spotlight so the light canvas isn't flat */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(80% 40% at 50% -8%, rgba(42,79,208,0.12), transparent 62%)" }} />

      {/* header, logo home + back to fleet */}
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

      {/* hero title */}
      <div className="relative z-10 px-5 pt-8 text-center sm:px-10 sm:pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-neutral-400">ApexRide · The collection</p>
        <h1 className="mt-3 font-josefin text-5xl font-light leading-[0.95] tracking-tight sm:text-7xl">Gallery</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-neutral-500">
          Every car in our fleet, shot across Lagos &amp; Abuja. Tap any photo to view it full-screen.
        </p>
        {/* meta row with a thin accent rule */}
        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-neutral-400">
          <span className="h-px w-8" style={{ background: ACCENT }} />
          {all.length} photographs
          <span className="h-px w-8" style={{ background: ACCENT }} />
        </div>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
        {all.length > 0 ? (
          <Masonry images={all} />
        ) : (
          <p className="py-20 text-center text-sm text-neutral-400">No photographs in the library yet.</p>
        )}

        {/* CTA footer, turn browsing into a booking */}
        <div className="mt-16 flex flex-col items-center gap-4 border-t border-neutral-900/[0.08] pt-12 text-center">
          <h2 className="font-josefin text-2xl font-light tracking-tight sm:text-3xl">Seen one you like?</h2>
          <p className="max-w-sm text-sm text-neutral-500">Reserve any vehicle in the collection, chauffeur-driven across Lagos &amp; Abuja.</p>
          <Link
            href="/form"
            className="mt-1 inline-flex h-11 items-center gap-2 rounded-full px-7 text-sm font-semibold tracking-wide text-white transition-transform duration-150 hover:scale-[1.03]"
            style={{ background: ACCENT, boxShadow: "0 14px 30px -12px rgba(42,79,208,0.6)" }}
          >
            Book a ride
          </Link>
        </div>
      </div>
    </main>
  );
}
