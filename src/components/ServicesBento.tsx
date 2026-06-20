"use client";

// Services as scroll-synced bento grids: as the camera settles on each pose, that
// service's bento fades in (one at a time), then out as the camera moves on.
// Driven off `tourProgress` — the same value that drives the camera poses.
import { useEffect, useRef, useState } from "react";
import {
  Handshake,
  Plane,
  Luggage,
  Clock,
  Heart,
  Sparkles,
  UserCheck,
  Users,
  Car,
  Timer,
  CalendarCheck,
  ReceiptText,
  Percent,
  Route,
  BadgeCheck,
  Compass,
  Map as MapIcon,
  Landmark,
  Camera,
  Gem,
  Lock,
  UserRound,
  Crown,
  type LucideIcon,
} from "lucide-react";

type Feat = { label: string; Icon: LucideIcon };
type Service = {
  index: string;
  title: string;
  blurb: string;
  stat: string;
  statLabel: string;
  features: Feat[];
};

const SERVICES: Service[] = [
  {
    index: "01",
    title: "Airport Transfers",
    blurb: "Smooth pickups and arrivals across Lagos and Abuja airports.",
    stat: "24/7",
    statLabel: "availability",
    features: [
      { label: "Meet and greet", Icon: Handshake },
      { label: "Flight tracking", Icon: Plane },
      { label: "Luggage help", Icon: Luggage },
      { label: "Round the clock", Icon: Clock },
    ],
  },
  {
    index: "02",
    title: "Wedding Transportation",
    blurb: "Elegant cars that make the big day completely effortless.",
    stat: "100%",
    statLabel: "styled",
    features: [
      { label: "Bridal cars", Icon: Heart },
      { label: "Ribbon styling", Icon: Sparkles },
      { label: "Trained chauffeurs", Icon: UserCheck },
      { label: "Guest shuttles", Icon: Users },
    ],
  },
  {
    index: "03",
    title: "Corporate Events",
    blurb: "Dependable transport for meetings, conferences and guests.",
    stat: "On time",
    statLabel: "every trip",
    features: [
      { label: "Executive sedans", Icon: Car },
      { label: "Punctual pickups", Icon: Timer },
      { label: "Flexible booking", Icon: CalendarCheck },
      { label: "Corporate billing", Icon: ReceiptText },
    ],
  },
  {
    index: "04",
    title: "Group Transportation",
    blurb: "Comfortable rides for groups of any size, all together.",
    stat: "32",
    statLabel: "seats",
    features: [
      { label: "Up to 32 seats", Icon: Users },
      { label: "Group rates", Icon: Percent },
      { label: "Route planning", Icon: Route },
      { label: "Seasoned drivers", Icon: BadgeCheck },
    ],
  },
  {
    index: "05",
    title: "City Tours",
    blurb: "Discover Lagos and Abuja with a knowledgeable local guide.",
    stat: "Local",
    statLabel: "guides",
    features: [
      { label: "Local guides", Icon: Compass },
      { label: "Custom routes", Icon: MapIcon },
      { label: "Top landmarks", Icon: Landmark },
      { label: "Cultural stops", Icon: Camera },
    ],
  },
  {
    index: "06",
    title: "Executive Travel",
    blurb: "Discreet, premium travel for executives and VIPs.",
    stat: "100%",
    statLabel: "private",
    features: [
      { label: "Luxury fleet", Icon: Gem },
      { label: "Total privacy", Icon: Lock },
      { label: "Personal chauffeur", Icon: UserRound },
      { label: "VIP service", Icon: Crown },
    ],
  },
];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (x: number) => {
  x = clamp01(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const SERVICE_DWELL = 0.65;

// The services share ONE morphing glass panel: it travels between each service's
// on-screen anchor, pinching into a CIRCLE while it moves and expanding back to a
// rounded SQUARE when it arrives — then that service's card content fades in.
// ANCHOR_X = horizontal centre per service (screen fraction): Airport centre,
// Wedding right, Corporate left, Group right, City Tours RIGHT, Executive centre.
const ANCHOR_X = [0.5, 0.85, 0.15, 0.85, 0.85, 0.5];
// ANCHOR_Y = vertical centre per service (screen fraction). Mostly mid-screen;
// City Tours sits a touch LOWER so it doesn't crowd the top of that framing.
const ANCHOR_Y = [0.5, 0.5, 0.5, 0.5, 0.58, 0.5];
const PANEL_MAX_W = 448; // resting panel width (px) on desktop
const PANEL_H = 480; // resting panel height (px)
const BLOB_D = 104; // circle diameter at mid-transit (px)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function ServicesBento({
  isLight,
  tourProgress,
}: {
  isLight: boolean;
  tourProgress: { current: number };
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const [panelW, setPanelW] = useState(PANEL_MAX_W);

  // The resting panel hugs EACH card's own height, so every card keeps the same
  // p-3 spacing on all four sides (not just the tallest — that left shorter cards
  // with extra top/bottom gap). A morphing shape can't auto-size, so we measure
  // HIDDEN fixed-width copies of every card. (Measuring the live panel is
  // unreliable — its width animates/collapses with scroll.)
  const measurers = useRef<(HTMLDivElement | null)[]>([]);
  const cardHeights = useRef<number[]>([]);
  useEffect(() => {
    const updatePanelWidth = () => {
      setPanelW(Math.min(PANEL_MAX_W, Math.max(300, window.innerWidth - 32)));
    };
    updatePanelWidth();
    window.addEventListener("resize", updatePanelWidth);
    return () => window.removeEventListener("resize", updatePanelWidth);
  }, []);

  useEffect(() => {
    const measure = () => {
      measurers.current.forEach((el, i) => {
        if (el && el.offsetHeight > 0) cardHeights.current[i] = el.offsetHeight;
      });
    };
    measure();
    const t = setTimeout(measure, 300); // re-measure once fonts/layout settle
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, [panelW]);

  useEffect(() => {
    let raf = 0;
    const N = SERVICES.length;
    const TOTAL_BANDS = N + 1; // 6 services + a final FOOTER band (top-of-car, no card)
    const loop = () => {
      const p = clamp01(tourProgress.current ?? 0);
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mobile = vw < 640;
      const restingW = Math.min(PANEL_MAX_W, Math.max(300, vw - 32));
      const restingBlob = mobile ? 78 : BLOB_D;
      // the panel forms as the camera settles on the opening framing; the FIRST
      // card's content fades in just AFTER, once the panel is a square. Both sit
      // inside the opening band's dwell (band 0 ends ≈ p 0.14, dwell ≈ p 0.09).
      const panelIn = smooth(clamp01((p - 0.01) / 0.045)); // panel forms p 0.01→0.055
      const firstContentIn = smooth(clamp01((p - 0.05) / 0.03)); // content p 0.05→0.08
      const u = p * TOTAL_BANDS; // one equal scroll band per service + footer
      const i0 = Math.min(TOTAL_BANDS - 1, Math.floor(u));
      const f = u - i0;
      const segT = smooth(clamp01((f - SERVICE_DWELL) / (1 - SERVICE_DWELL)));
      const circleness = Math.sin(clamp01(segT) * Math.PI); // 0 at rest, 1 mid-move

      // The panel travels between anchors; as it leaves the LAST service (Executive)
      // into the FOOTER band it pinches to a circle and fades out (no card there).
      const inFooter = i0 >= N;
      const exit = i0 === N - 1 ? 1 - segT : inFooter ? 0 : 1;
      const fromX = mobile ? 0.5 : ANCHOR_X[Math.min(N - 1, i0)];
      const toX = mobile ? 0.5 : ANCHOR_X[Math.min(N - 1, i0 + 1)];
      const cx = lerp(fromX, toX, segT);
      const fromY = mobile ? 0.5 : ANCHOR_Y[Math.min(N - 1, i0)];
      const toY = mobile ? 0.5 : ANCHOR_Y[Math.min(N - 1, i0 + 1)];
      const cy = lerp(fromY, toY, segT);
      // resting height tracks the CURRENT card's own content (interpolating
      // between the two during a move), so every card keeps equal p-3 on all sides.
      const hFrom = cardHeights.current[Math.min(N - 1, i0)] ?? PANEL_H;
      const hTo = cardHeights.current[Math.min(N - 1, i0 + 1)] ?? PANEL_H;
      const restingH = lerp(hFrom, hTo, segT);
      const w = lerp(restingW, restingBlob, circleness) * panelIn * exit;
      const h = lerp(restingH, restingBlob, circleness) * panelIn * exit;
      const rad = lerp(mobile ? 26 : 34, restingBlob / 2, circleness);
      const panel = panelRef.current;
      if (panel) {
        const topY = mobile
          ? Math.max(h / 2 + 82, Math.min(vh * 0.62, vh - h / 2 - 92))
          : vh * cy;
        panel.style.left = `${(cx * 100).toFixed(2)}%`;
        panel.style.top = `${topY.toFixed(1)}px`;
        panel.style.width = `${w.toFixed(1)}px`;
        panel.style.height = `${h.toFixed(1)}px`;
        panel.style.borderRadius = `${rad.toFixed(1)}px`;
        panel.style.opacity = (panelIn * exit).toFixed(3);
      }

      // Card content shows only when the panel is a settled square at this
      // service's anchor — hidden while it's a circle / in motion, then fades in.
      for (let i = 0; i < N; i++) {
        const el = layers.current[i];
        if (!el) continue;
        let a = 0;
        // current card leaves FAST as the rectangle starts morphing (×4 → gone by
        // circleness ≈ 0.25); the next card fades in more gently as it re-squares.
        if (i === i0) a = segT < 0.5 ? clamp01(1 - circleness * 4) : 0;
        // the incoming card's BOXES appear early (×1.5) as empty placeholders while
        // the panel is still morphing up, so the grid has something to settle into.
        if (i === i0 + 1 && i0 + 1 < N) a = segT >= 0.5 ? clamp01(1 - circleness * 1.5) : 0;
        if (i === 0) a *= firstContentIn; // the opening card waits for the panel
        a *= exit; // fade the content out with the panel into the footer
        el.style.opacity = a.toFixed(3);
        // fixed width (no reflow). `--reveal` drives each cell's scale-from-centre
        // (see Bento), so the boxes emanate from the middle and spread to their
        // grid positions as the bg morphs — instead of the whole card scaling.
        el.style.width = `${restingW.toFixed(1)}px`;
        const s = clamp01(Math.min(w / restingW, h / restingH));
        el.style.setProperty("--reveal", s.toFixed(3));
        // the TEXT/icons inside lag the boxes: empty placeholder cells form first,
        // then the content fades in once the panel is ~settled (s ≳ 0.86).
        el.style.setProperty("--content-reveal", smooth(clamp01((s - 0.86) / 0.14)).toFixed(3));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tourProgress]);

  const accent = isLight ? "#00209C" : "#FDBA16";
  const text = isLight ? "text-neutral-900" : "text-white";
  const dim = isLight ? "text-neutral-700" : "text-white/65";

  return (
    <div className={`pointer-events-none fixed inset-0 z-[5] ${text}`}>
      {/* hidden measurers — fixed-width copies of every card, used only to size
          the panel to the tallest card's content (the live panel's width animates
          with scroll, so it can't be measured). Never painted. */}
      <div aria-hidden className="invisible absolute left-0 top-0" style={{ width: panelW }}>
        {SERVICES.map((s, i) => (
          <div
            key={s.index}
            ref={(el) => {
              measurers.current[i] = el;
            }}
            className="absolute left-0 top-0 flex w-full items-center justify-center p-3"
          >
            <Bento s={s} accent={accent} light={isLight} dim={dim} />
          </div>
        ))}
      </div>
      {/* ONE morphing glass panel shared by every service. It moves between the
          service anchors (a circle while travelling, a rounded square at rest);
          each service's card content is stacked inside and fades in once settled.
          NB: this element carries the transform that centres it, so its children
          can't use backdrop-filter — the panel itself does the frosting. */}
      <div
        ref={panelRef}
        className="absolute -translate-x-1/2 -translate-y-1/2 overflow-hidden border"
        style={{
          left: "50%",
          top: "50%",
          width: panelW,
          height: PANEL_H,
          borderRadius: 34,
          opacity: 0,
          background: isLight
            ? // a soft shade of white (not pure #fff, which reads too bright on the
              // light page) with a barely-there cool tint
              "linear-gradient(150deg, rgba(233,237,244,0.9), rgba(221,227,237,0.74))"
            : "linear-gradient(150deg, rgba(34,38,48,0.72), rgba(12,14,20,0.58))",
          borderColor: isLight ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.24)",
          backdropFilter: "blur(42px) saturate(170%)",
          WebkitBackdropFilter: "blur(42px) saturate(170%)",
          boxShadow: isLight
            ? "inset 0 1px 0 rgba(255,255,255,0.88), 0 24px 80px rgba(15,23,42,0.12)"
            : "inset 0 1px 0 rgba(255,255,255,0.16), 0 24px 90px rgba(0,0,0,0.24)",
          willChange: "left, width, height, border-radius",
        }}
      >
        {SERVICES.map((s, i) => (
          <div
            key={s.index}
            className="absolute inset-0 flex items-center justify-center"
          >
            {/* The content is a FIXED-size unit (width set in the loop) so it never
                reflows with the panel; the loop scales it + fades it from low
                opacity as the bg morphs, so it grows in as a WHOLE rather than
                being clipped/revealed piece-by-piece by the panel edge. */}
            <div
              ref={(el) => {
                layers.current[i] = el;
              }}
              className="p-3"
              style={{ opacity: 0, willChange: "transform, opacity" }}
            >
              <Bento s={s} accent={accent} light={isLight} dim={dim} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Bento({
  s,
  accent,
  light,
  dim,
}: {
  s: Service;
  accent: string;
  light: boolean;
  dim: string;
}) {
  // Cells and the shell are both translucent so the fixed car/backdrop behind
  // them frosts through like glass as each bento scrolls into view.
  const cellBg = light
    ? // very subtle wash of the brand blue (#2A4FD0), fading to near-white
      "linear-gradient(145deg, rgba(229,234,250,0.9), rgba(246,248,253,0.72))"
    : // very subtle warm tint of the yellow accent (#FDBA16) over the dark glass
      "linear-gradient(145deg, rgba(255,249,232,0.24), rgba(255,252,242,0.14))";
  const cellBorder = light ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.22)";
  const iconTint = `color-mix(in srgb, ${accent} ${light ? "14%" : "24%"}, transparent)`;
  const inkOnAccent = light ? "#ffffff" : "#16161a";
  const Lead = s.features[0].Icon;
  const base = "rounded-2xl border p-3.5 sm:rounded-3xl sm:p-5";
  const neutral = {
    background: cellBg,
    borderColor: cellBorder,
    backdropFilter: "blur(18px) saturate(150%)",
    WebkitBackdropFilter: "blur(18px) saturate(150%)",
    boxShadow: light
      ? "inset 0 1px 0 rgba(255,255,255,0.75)"
      : "inset 0 1px 0 rgba(255,255,255,0.13)",
  };

  // Each cell scales by `--reveal` (set on the layer by the loop) from the card's
  // centre COLUMN but its OWN vertical centre — so within each row the boxes draw
  // out sideways (left boxes to the left, right boxes to the right) while staying
  // in their row. transform-origin X = grid centre in the cell's box (offset
  // metrics ignore transforms, so it's robust mid-morph); Y = the cell's own 50%.
  const gridRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const place = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const gx = grid.offsetWidth / 2;
      cellRefs.current.forEach((c) => {
        if (!c || !c.offsetWidth) return;
        const ox = ((gx - c.offsetLeft) / c.offsetWidth) * 100;
        c.style.transformOrigin = `${ox.toFixed(1)}% 50%`;
      });
    };
    place();
    const t = setTimeout(place, 350); // re-place once widths/fonts settle
    window.addEventListener("resize", place);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", place);
    };
  }, [s]);
  const cellTf = { transform: "scale(var(--reveal, 1))", willChange: "transform" };
  // text/icons fade in AFTER the boxes (see --content-reveal in the loop), so each
  // cell first reads as an empty placeholder, then fills with content.
  const contentFade = { opacity: "var(--content-reveal, 1)" };

  return (
    // The rounded glass shell is now the shared MORPHING PANEL (rendered above);
    // this just lays the cells out inside it. The grid fills the panel's padding.
    <div ref={gridRef} className="relative grid w-full grid-cols-4 gap-2 sm:gap-2.5">
      {/* TITLE — tall hero cell with a big faint icon watermark */}
      <div
        ref={(el) => {
          cellRefs.current[0] = el;
        }}
        className={`${base} relative col-span-2 row-span-2 flex flex-col justify-end overflow-hidden`}
        style={{ ...neutral, ...cellTf }}
      >
        <Lead
          className="pointer-events-none absolute -right-4 -top-4 sm:-right-5 sm:-top-5"
          size={112}
          strokeWidth={1}
          style={{ color: accent, opacity: light ? 0.1 : 0.14 }}
        />
        <h3
          className="relative text-[1.28rem] font-medium leading-[1.08] tracking-tight sm:text-[1.6rem]"
          style={contentFade}
        >
          {s.title}
        </h3>
      </div>

      {/* STAT — accent-filled cell for the colour pop */}
      <div
        ref={(el) => {
          cellRefs.current[1] = el;
        }}
        className={`${base} col-span-2 flex flex-col justify-center`}
        style={{
          background: `linear-gradient(145deg, ${accent}, color-mix(in srgb, ${accent} 74%, transparent))`,
          borderColor: "rgba(255,255,255,0.18)",
          color: inkOnAccent,
          boxShadow: light
            ? "inset 0 1px 0 rgba(255,255,255,0.28)"
            : "inset 0 1px 0 rgba(255,255,255,0.2)",
          ...cellTf,
        }}
      >
        <span className="text-2xl font-semibold leading-none tracking-tight sm:text-3xl" style={contentFade}>{s.stat}</span>
        <span
          className="mt-1.5 text-[11px] sm:text-[13px]"
          style={{ opacity: "calc(0.6 * var(--content-reveal, 1))" }}
        >
          {s.statLabel}
        </span>
      </div>

      {/* BLURB */}
      <div
        ref={(el) => {
          cellRefs.current[2] = el;
        }}
        className={`${base} col-span-2 flex items-center`}
        style={{ ...neutral, ...cellTf }}
      >
        <p className={`text-[11.5px] leading-relaxed sm:text-[13px] ${dim}`} style={contentFade}>{s.blurb}</p>
      </div>

      {/* FEATURE tiles — 2 × 2 */}
      {s.features.map((f, fi) => (
        <div
          key={f.label}
          ref={(el) => {
            cellRefs.current[3 + fi] = el;
          }}
          className={`${base} col-span-2 flex items-center gap-2.5 !p-2.5 sm:gap-3 sm:!p-3.5`}
          style={{ ...neutral, ...cellTf }}
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl sm:h-9 sm:w-9"
            style={{ background: iconTint, color: accent, ...contentFade }}
          >
            <f.Icon className="h-4 w-4 sm:h-[17px] sm:w-[17px]" strokeWidth={1.9} />
          </span>
          <span className="text-[12px] font-medium leading-tight tracking-wide sm:text-sm" style={contentFade}>{f.label}</span>
        </div>
      ))}
    </div>
  );
}
