// Live tuning store for the scroll-tour camera poses. Plain data (no three.js)
// so both CarStage (reads it every frame) and the CameraTuner panel (writes it)
// can import it without pulling WebGL into the page bundle.
//
// Each pose is normalised — multiply by the car's measured size at runtime:
//   a  → angle around the car, × Math.PI   (0 = nose, 1 = rear)
//   r  → distance from centre,  × car length L
//   h  → camera height,         × car height Hc
//   lx → look-at X (car frame), × car width  (wsize.x)
//   ly → look-at Y,             × car height Hc
//   lz → look-at Z,             × car length L   (negative = toward the rear)
//   fov → vertical field of view in degrees (higher = wider / more fisheye)
export type TunePose = {
  /** "orbit": position is the cylinder (a/r/h). "free": position is px/py/pz. */
  mode: "orbit" | "free";
  // orbit position (a cylinder around the car centre)
  a: number;
  r: number;
  h: number;
  // free position (car frame, relative to the car centre): px×L, py×Hc, pz×L
  px: number;
  py: number;
  pz: number;
  // look-at target (car frame)
  lx: number;
  ly: number;
  lz: number;
  fov: number;
};

export const cameraTuning: {
  /** hold the `active` pose regardless of scroll, so a pose can be tuned still */
  freeze: boolean;
  /** which pose the panel edits / freezes */
  active: number;
  /** click-to-pose target (pose index). When set, the camera eases here instead
      of following scroll; cleared the moment the visitor scrolls. */
  jumpTo: number | null;
  poses: TunePose[];
} = {
  freeze: false,
  active: 0,
  jumpTo: null,
  // 6 service framings (one per bento card) + a final FOOTER framing (top-of-car).
  // The 5th (City Tours) is a LEFT-side view, the 6th (Executive Travel) is an
  // INTERIOR shot, and the 7th sits above the car for the "Book with us" footer.
  poses: [
    { mode: "orbit", a: 0.12, r: 0.55, h: 0.42, px: 0.2, py: 0.42, pz: 0.51, lx: 0.1, ly: 0.48, lz: 0.3, fov: 52 }, // headlamp — close perspective, front-3/4 (FIRST scroll move)
    { mode: "orbit", a: 0.4, r: 0.46, h: 0.3, px: 0.44, py: 0.3, pz: 0.14, lx: 0.15, ly: 0.31, lz: 0.21, fov: 28 }, // RIGHT FRONT tyre — zoomed, standard 50mm, level on the rim
    { mode: "free", a: 1.82, r: 0.47, h: 0.46, px: -0.25, py: 0.46, pz: 0.4, lx: 0.17, ly: 0.65, lz: -0.03, fov: 76 }, // flank — FREE so the POV shifts progressively as you scroll into it
    { mode: "free", a: 0.19, r: 0.17, h: 0.82, px: 0.1, py: 0.82, pz: 0.14, lx: -0.34, ly: 0.55, lz: -0.6, fov: 104 }, // RIGHT MIRROR POV — your tuned settings
    { mode: "orbit", a: 1.13, r: 0.5, h: 0.4, px: -0.2, py: 0.4, pz: -0.42, lx: 0.0, ly: 0.45, lz: -0.05, fov: 46 }, // City Tours — rear-LEFT 3/4 (left back light), look-at on the CAR CENTRE so the camera stays on the car through the move and the car sits centred (not off to the side)
    { mode: "free", a: 1.0, r: 0.22, h: 0.91, px: 0.0, py: 0.91, pz: -0.18, lx: 0.0, ly: 0.5, lz: 0.21, fov: 45 }, // Executive Travel — INTERIOR: FREE pose that moves straight in through the rear glass into the cabin (the original interior camera movement)
    { mode: "orbit", a: 1.0, r: 0.25, h: 1.73, px: 0.0, py: 1.73, pz: -0.25, lx: 0.0, ly: 1.15, lz: 0.07, fov: 63 }, // FOOTER — top-of-car overhead (your tuned values). Re-tune live at /#footer
  ],
};
