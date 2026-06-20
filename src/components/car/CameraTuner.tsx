"use client";

// Dev panel to tune the scroll-tour camera live. It writes straight into the
// shared `cameraTuning` store, which CarStage reads every frame — so dragging a
// slider moves the camera instantly. "Freeze" holds the selected pose so you can
// tune it without scrolling, and the readout gives the exact code line to paste
// back into the poses (multipliers: a×π, r×L, h×Hc, look = (x×width, y×Hc, z×L)).

import { useReducer, useState, type CSSProperties } from "react";
import { cameraTuning, type TunePose } from "@/components/car/cameraTuning";
import type { LensType } from "@/components/car/CarStage";

// Lens types: the first three are PERSPECTIVE focal lengths (set the fov), the
// last is the real cubemap fisheye. fov values are vertical-fov approximations
// of the full-frame focal length on this scene.
const LENS_TYPES: { id: string; label: string; mm: string; fov: number | null; desc: string }[] = [
  { id: "standard", label: "Standard", mm: "~50mm", fov: 28, desc: "Similar to human vision" },
  { id: "wide", label: "Wide-angle", mm: "24–35mm", fov: 45, desc: "Wider field of view" },
  { id: "ultrawide", label: "Ultra-wide", mm: "14–24mm", fov: 78, desc: "Very expansive view" },
  { id: "fisheye", label: "Fisheye", mm: "8–16mm", fov: null, desc: "Extremely wide, strong distortion" },
];

type NumKey = Exclude<keyof TunePose, "mode">;
type Field = { key: NumKey; label: string; min: number; max: number; step: number };

const ORBIT_FIELDS: Field[] = [
  { key: "a", label: "angle ×π", min: 0, max: 2, step: 0.01 },
  { key: "r", label: "dist ×L", min: 0.05, max: 1.6, step: 0.01 },
  { key: "h", label: "height ×Hc", min: -0.2, max: 1.6, step: 0.01 },
];
const FREE_FIELDS: Field[] = [
  { key: "px", label: "pos X ×L", min: -2, max: 2, step: 0.01 },
  { key: "py", label: "pos Y ×Hc", min: 0, max: 2, step: 0.01 },
  { key: "pz", label: "pos Z ×L", min: -2, max: 2, step: 0.01 },
];
const LOOK_FIELDS: Field[] = [
  { key: "lx", label: "lookX ×w", min: -1, max: 1, step: 0.01 },
  { key: "ly", label: "lookY ×Hc", min: 0, max: 1.6, step: 0.01 },
  { key: "lz", label: "lookZ ×L", min: -0.6, max: 0.6, step: 0.01 },
  { key: "fov", label: "fov°", min: 20, max: 140, step: 1 },
];

// Output the store format (cameraTuning.ts) so it pastes straight back in.
function codeLine(p: TunePose): string {
  const n = (v: number) => v.toFixed(2);
  return `{ mode: "${p.mode}", a: ${n(p.a)}, r: ${n(p.r)}, h: ${n(p.h)}, px: ${n(p.px)}, py: ${n(p.py)}, pz: ${n(p.pz)}, lx: ${n(p.lx)}, ly: ${n(p.ly)}, lz: ${n(p.lz)}, fov: ${Math.round(p.fov)} },`;
}

const btn: CSSProperties = {
  padding: "4px 8px",
  borderRadius: 6,
  background: "rgba(255,255,255,0.08)",
  color: "#e6e8ec",
  border: "1px solid rgba(255,255,255,0.15)",
  cursor: "pointer",
  font: "11px ui-monospace, SFMono-Regular, monospace",
};

export default function CameraTuner({
  lens,
  onLens,
  fisheyeZoom,
  onFisheyeZoom,
}: {
  lens: LensType;
  onLens: (l: LensType) => void;
  fisheyeZoom: number;
  onFisheyeZoom: (z: number) => void;
}) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [open, setOpen] = useState(true);
  // when on, dragging fov keeps the car the same size (adjusts distance) — so
  // fov only changes the wide-angle look and distance is the real zoom
  const [lockZoom, setLockZoom] = useState(true);
  const t = cameraTuning;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ ...btn, position: "fixed", left: 12, top: 64, zIndex: 50, pointerEvents: "auto" }}>
        ⚙ Camera
      </button>
    );
  }

  const pose = t.poses[t.active];
  // which radio is lit: fisheye mode, else categorise the active pose's fov
  const currentLensId =
    lens === "fisheye" ? "fisheye" : pose.fov <= 35 ? "standard" : pose.fov <= 60 ? "wide" : "ultrawide";

  return (
    <div
      style={{
        position: "fixed",
        left: 12,
        top: 64,
        zIndex: 50,
        width: 264,
        padding: 12,
        borderRadius: 10,
        background: "rgba(10,12,16,0.88)",
        color: "#e6e8ec",
        font: "11px ui-monospace, SFMono-Regular, monospace",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.12)",
        pointerEvents: "auto",
        maxHeight: "82vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong>Camera tuner</strong>
        <button onClick={() => setOpen(false)} style={btn}>×</button>
      </div>

      {/* lens type (radio) — Standard/Wide/Ultra-wide are perspective focal
          lengths; Fisheye is the real barrel-distortion camera */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ marginBottom: 4, opacity: 0.8 }}>Lens type (active pose)</div>
        {LENS_TYPES.map((lt) => {
          const checked = currentLensId === lt.id;
          return (
            <label key={lt.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3, cursor: "pointer" }}>
              <input
                type="radio"
                name="lenstype"
                checked={checked}
                onChange={() => {
                  if (lt.id === "fisheye") {
                    onLens("fisheye");
                  } else {
                    if (lens === "fisheye") onLens("perspective");
                    if (lt.fov != null) pose.fov = lt.fov;
                  }
                  force();
                }}
              />
              <span style={{ flex: 1 }}>
                {lt.label} <span style={{ opacity: 0.5 }}>{lt.mm}</span>
              </span>
            </label>
          );
        })}
        <div style={{ opacity: 0.55, fontSize: 10, marginTop: 2 }}>
          {LENS_TYPES.find((l) => l.id === currentLensId)?.desc}
        </div>
      </div>
      {lens === "fisheye" && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <span style={{ width: 66 }}>fish spread</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={fisheyeZoom}
            onChange={(e) => onFisheyeZoom(parseFloat(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ width: 42, textAlign: "right" }}>{fisheyeZoom.toFixed(2)}</span>
        </label>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {t.poses.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              t.active = i;
              force();
            }}
            style={{ ...btn, minWidth: 52, flex: "1 0 auto", background: t.active === i ? "#2a4fd0" : "rgba(255,255,255,0.08)" }}
          >
            Pose {i}
          </button>
        ))}
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={t.freeze}
          onChange={(e) => {
            t.freeze = e.target.checked;
            force();
          }}
        />
        Freeze on this pose (tune without scrolling)
      </label>

      <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
        <input type="checkbox" checked={lockZoom} onChange={(e) => setLockZoom(e.target.checked)} />
        fov keeps car size (use <b>dist/pos</b> to zoom)
      </label>

      {/* position mode: orbit cylinder vs free x/y/z (values convert on switch) */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["orbit", "free"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              if (pose.mode === m) return;
              if (m === "free") {
                const ang = Math.PI * pose.a;
                pose.px = Math.sin(ang) * pose.r;
                pose.py = pose.h;
                pose.pz = Math.cos(ang) * pose.r;
              } else {
                pose.r = Math.hypot(pose.px, pose.pz);
                pose.a = ((Math.atan2(pose.px, pose.pz) / Math.PI) + 2) % 2;
                pose.h = pose.py;
              }
              pose.mode = m;
              force();
            }}
            style={{ ...btn, flex: 1, background: pose.mode === m ? "#2a4fd0" : "rgba(255,255,255,0.08)" }}
          >
            {m === "orbit" ? "Orbit (a/r/h)" : "Free (x/y/z)"}
          </button>
        ))}
      </div>

      {[...(pose.mode === "free" ? FREE_FIELDS : ORBIT_FIELDS), ...LOOK_FIELDS].map((f) => (
        <label key={f.key} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <span style={{ width: 66 }}>{f.label}</span>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={pose[f.key]}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (f.key === "fov" && lockZoom && v > 0 && pose.fov > 0) {
                // dolly to hold the car's apparent size as the lens widens/narrows
                const factor =
                  Math.tan(((pose.fov * Math.PI) / 180) / 2) / Math.tan(((v * Math.PI) / 180) / 2);
                if (pose.mode === "free") {
                  pose.px *= factor;
                  pose.py *= factor;
                  pose.pz *= factor;
                } else {
                  pose.r *= factor;
                }
              }
              pose[f.key] = v;
              force();
            }}
            style={{ flex: 1 }}
          />
          <span style={{ width: 42, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
            {pose[f.key].toFixed(2)}
          </span>
        </label>
      ))}

      <div
        style={{
          marginTop: 10,
          padding: 8,
          borderRadius: 6,
          background: "rgba(0,0,0,0.4)",
          wordBreak: "break-all",
          lineHeight: 1.5,
        }}
      >
        {codeLine(pose)}
      </div>
      <button
        onClick={() => navigator.clipboard?.writeText(codeLine(pose))}
        style={{ ...btn, width: "100%", marginTop: 6 }}
      >
        Copy pose line
      </button>
    </div>
  );
}
