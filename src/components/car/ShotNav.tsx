"use client";

// Bottom-centre shot selector: click an angle and the camera cranes to that
// detail pose. It writes `cameraTuning.jumpTo` (read by CarStage every frame),
// which overrides scroll until the visitor scrolls again. Labels are in the same
// order as the poses in cameraTuning.
import { useState } from "react";
import { cameraTuning } from "@/components/car/cameraTuning";

const SHOTS = ["Grille", "Roof", "Headlamp", "Tyre", "Flank", "Mirror"];

export default function ShotNav({ isLight }: { isLight: boolean }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full p-1">
      {SHOTS.map((label, i) => {
        const on = active === i;
        return (
          <button
            key={label}
            onClick={() => {
              cameraTuning.freeze = false; // don't get stuck on a dev-frozen pose
              cameraTuning.jumpTo = i;
              setActive(i);
            }}
            className={`pointer-events-auto rounded-full px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md transition-all duration-300 border ${
              on
                ? isLight
                  ? "border-[#00209C] bg-[#00209C] text-white"
                  : "border-[#FDBA16] bg-[#FDBA16] text-neutral-950"
                : isLight
                  ? "border-neutral-900/10 bg-white/45 text-neutral-700 hover:bg-white/80"
                  : "border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/15 hover:text-white"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
