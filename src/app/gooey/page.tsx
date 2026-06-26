"use client";

// Gooey dashboard icons ported from a-boys-portfolio. The "gooey" effect is an
// SVG goo filter (feGaussianBlur + feColorMatrix alpha squeeze) over framer-motion
// morphs, so shapes merge/split like liquid. Avatars/profile are placeholders.
import { Gooey, ProfileGooey, GooeySimple, SearchGooey } from "./Gooey";

export default function GooeyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-7 pt-16 md:px-20 md:pt-10 lg:px-56">
        <h1 className="text-2xl uppercase tracking-wide">
          What if dashboard icons were gooey
        </h1>
        <p className="mt-3 max-w-md text-sm text-foreground/55">
          Hover (or tap) each icon. The morph uses an SVG goo filter so the shapes
          stretch and merge like liquid — avatars are placeholders.
        </p>

        <div className="flex flex-col gap-40 py-32">
          <ProfileGooey />
          <GooeySimple label="Projects" />
          <Gooey />
          <SearchGooey />
        </div>
      </section>
    </main>
  );
}
