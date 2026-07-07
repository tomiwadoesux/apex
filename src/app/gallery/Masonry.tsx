"use client";

// Client masonry + lightbox for the gallery. CSS columns keep every photo's
// natural shape (portrait / landscape / square); clicking one opens a
// full-screen lightbox with keyboard + on-screen navigation.

import { useState, useEffect, useCallback } from "react";

export default function Masonry({ images }: { images: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + images.length) % images.length)),
    [images.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, step]);

  return (
    <>
      <div className="columns-2 gap-3 sm:columns-3 sm:gap-4 lg:columns-4 [column-fill:balance]">
        {images.map((src, i) => (
          <figure
            key={src}
            onClick={() => setOpen(i)}
            className="group mb-3 block cursor-pointer break-inside-avoid overflow-hidden rounded-2xl border border-neutral-900/[0.08] bg-white shadow-[0_12px_36px_-22px_rgba(15,23,42,0.28)] transition-shadow duration-300 hover:shadow-[0_22px_50px_-20px_rgba(15,23,42,0.4)] sm:mb-4"
          >
            <div className="relative overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt="ApexRide"
                loading="lazy"
                className="w-full transition-transform duration-[600ms] ease-out group-hover:scale-[1.05]"
              />
              {/* subtle darken + expand hint on hover */}
              <div className="pointer-events-none absolute inset-0 flex items-end justify-end bg-gradient-to-t from-black/30 via-transparent to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/90 text-neutral-900 shadow-md">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </span>
              </div>
            </div>
          </figure>
        ))}
      </div>

      {/* lightbox */}
      {open !== null && (
        <div
          onClick={close}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 backdrop-blur-sm"
          style={{ animation: "gal-fade 200ms ease-out" }}
        >
          <style>{`@keyframes gal-fade{from{opacity:0}to{opacity:1}}`}</style>

          {/* close */}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 sm:right-6 sm:top-6"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>

          {/* prev / next */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            aria-label="Previous"
            className="absolute left-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 sm:left-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(1); }}
            aria-label="Next"
            className="absolute right-3 grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/15 sm:right-6"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[open]}
            alt="ApexRide"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold tracking-wide text-white/80">
            {open + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
