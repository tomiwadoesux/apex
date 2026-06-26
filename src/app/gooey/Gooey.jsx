"use client";

import { motion, AnimatePresence } from "framer-motion";
import React, { useState, useCallback, useRef, useEffect } from "react";

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setMobile(mq.matches);
    const handler = (e) => setMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return mobile;
}

// Forces a GPU repaint on mobile after gooey animations to clear filter line artifacts.
// Delay must exceed the longest animation duration (~750ms with power4 inOut easing).
function useGooeyRepaint(isMobile, deps) {
  const ref = useRef(null);
  useEffect(() => {
    if (!isMobile || !ref.current) return;
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.style.transform = "translateZ(0.1px)";
      requestAnimationFrame(() => {
        el.style.transform = "";
      });
    }, 850);
    return () => clearTimeout(t);
  }, deps);
  return ref;
}

const EASE = [0.76, 0, 0.24, 1]; // power4 inOut

const SPRING = {
  duration: 0.55,
  ease: EASE,
};

const BOUNCING_CIRCLES = [
  {
    id: "top", label: "connectors", activeX: 48, y: -42, size: 34, pillWidth: 85, pillX: 46, delay: 0.1,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
      </svg>
    )
  },
  {
    id: "center", label: "usage", activeX: 58, y: 0, size: 36, pillWidth: 65, pillX: 48, delay: 0,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    )
  },
  {
    id: "bottom", label: "tasks", activeX: 48, y: 42, size: 34, pillWidth: 60, pillX: 46, delay: 0.16,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-background">
        <polyline points="9 11 12 14 22 4"></polyline>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
      </svg>
    )
  }
];

const SIZE = 56;
const CX = SIZE / 2; // 28
const CY = SIZE / 2; // 28

// Padding added to each SVG viewBox so animated shapes never overflow the SVG viewport.
// Mobile Safari clips to the SVG viewport even with overflow="visible".
const PAD = 200;
const SVG_W = SIZE + PAD * 2;   // 456
const SVG_VB = `${-PAD} ${-PAD} ${SVG_W} ${SVG_W}`;

const PSIZE = 72;
const PCX = PSIZE / 2; // 36
const PCY = PSIZE / 2; // 36
const PSVG_W = PSIZE + PAD * 2; // 472
const PSVG_VB = `${-PAD} ${-PAD} ${PSVG_W} ${PSVG_W}`;

const FG = "var(--foreground)";

// Placeholder avatars — real images are intentionally omitted (per spec). A
// deterministic hue per name keeps each gooey dot visually distinct with no
// network fetch; the dot's first initial sits on a soft gradient.
const avatarHue = (name) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
};
const AvatarPlaceholder = ({ name }) => (
  <div
    className="flex h-full w-full items-center justify-center font-bold text-white"
    style={{
      background: `linear-gradient(135deg, hsl(${avatarHue(name)} 70% 58%), hsl(${(avatarHue(name) + 40) % 360} 70% 46%))`,
      fontSize: "0.5rem",
    }}
  >
    {name.slice(0, 1).toUpperCase()}
  </div>
);

const Gooey = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [clicked, setClicked] = useState(false); // false | "entering" | true | "closing" | "merging"
  const [hoverDot, setHoverDot] = useState(null); // 'center' | 'top' | 'bottom'

  const handleClick = () => {
    if (clicked === true) {
      setClicked("closing");
      setTimeout(() => {
        setClicked("merging");
        setTimeout(() => {
          setClicked(false);
          setOpen(false);
        }, 400);
      }, 650);
    } else if (open && !clicked) {
      setClicked("entering");
      setTimeout(() => setClicked(true), 100);
    } else if (!open) {
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!clicked && clicked !== "closing") {
      setOpen(false);
    }
  };

  const showHome = open && !clicked;
  const repaintRef = useGooeyRepaint(isMobile, [open, clicked]);

  return (
    <div ref={repaintRef} className="flex w-full flex-col items-center justify-center relative">
      <div className="relative" onPointerLeave={(e) => { if (e.pointerType === 'mouse') handleMouseLeave(); }}>
        {/* Invisible hover extension */}
        <div className="absolute -right-28 -bottom-24 -left-6 -top-20" />

        {/* Main gooey group — inline SVG with filter on <g> for mobile Safari */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg
            viewBox={SVG_VB}
            style={{ position: "absolute", left: -PAD, top: -PAD, width: SVG_W, height: SVG_W, pointerEvents: "none" }}
          >
            <defs>
              <filter id="GooeyMainFilter" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" />
              </filter>
              <filter id="GooeyMainFilterM" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" />
              </filter>
            </defs>
            <g filter={isMobile ? "url(#GooeyMainFilterM)" : "url(#GooeyMainFilter)"}>
              {/* Arrow */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  clicked === "merging"
                    ? { x: CX - 15, y: CY - 15, width: 30, height: 30, rx: 15, opacity: 0 }
                    : clicked
                      ? { x: CX + 58 - 15, y: CY - 15, width: 30, height: 30, rx: 15, opacity: 1 }
                      : open
                        ? { x: CX + 45 - 16, y: CY - 16, width: 32, height: 32, rx: 16, opacity: 1 }
                        : { x: CX - 15, y: CY - 15, width: 30, height: 30, rx: 15, opacity: 0 }
                }
                transition={
                  open && !clicked
                    ? { duration: 0.45, ease: EASE, opacity: { duration: 0.05 } }
                    : { duration: 0.25, ease: [0.76, 0, 1, 1], opacity: { duration: 0.05, delay: 0.2 } }
                }
              />
              {/* Home pill */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  showHome
                    ? { x: CX - 30, y: CY + 54 - 14, width: 60, height: 28, rx: 14, opacity: 1 }
                    : { x: CX - 14, y: CY, width: 28, height: 28, rx: 14, opacity: 0 }
                }
                transition={
                  showHome
                    ? {
                        y: { duration: 0.55, ease: EASE },
                        x: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        width: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        height: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        rx: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        opacity: { duration: 0.05 },
                      }
                    : {
                        duration: 0.25,
                        ease: [0.76, 0, 1, 1],
                        opacity: { duration: 0.05, delay: 0.2 },
                      }
                }
              />
              {/* Main shape */}
              <rect x={0} y={0} width={SIZE} height={SIZE} rx={CX} style={{ fill: FG }} />
            </g>
          </svg>

          {/* HTML overlays — arrow icon */}
          <motion.div
            className="absolute flex items-center justify-center cursor-pointer"
            initial={false}
            animate={
              clicked === "merging"
                ? { x: 0, width: 30, height: 30, borderRadius: 15, opacity: 0 }
                : clicked
                  ? { x: 58, width: 30, height: 30, borderRadius: 15, opacity: 1 }
                  : open
                    ? { x: 45, width: 32, height: 32, borderRadius: 16, opacity: 1 }
                    : { x: 0, width: 30, height: 30, borderRadius: 15, opacity: 0 }
            }
            transition={
              open && !clicked
                ? { duration: 0.45, ease: EASE, opacity: { duration: 0.05 } }
                : { duration: 0.25, ease: [0.76, 0, 1, 1], opacity: { duration: 0.05, delay: 0.2 } }
            }
            onClick={handleClick}
            style={{ pointerEvents: "auto" }}
          >
            <motion.svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-background"
              initial={false}
              animate={
                open && !clicked
                  ? { width: 14, height: 14, opacity: 1, x: 0 }
                  : { width: 0, height: 0, opacity: 0, x: -10 }
              }
              transition={
                open && !clicked
                  ? { duration: 0.65, ease: EASE, delay: 0.12, opacity: { duration: 0.2, delay: 0.12 } }
                  : { duration: 0.1 }
              }
            >
              <polyline points="9 6 15 12 9 18" />
            </motion.svg>
          </motion.div>

          {/* HTML overlay — "Agent" text */}
          <motion.div
            className="absolute flex items-center justify-center overflow-hidden pointer-events-none"
            initial={false}
            animate={
              showHome
                ? { y: 54, width: 60, height: 28, borderRadius: 14 }
                : { y: 0, width: SIZE, height: SIZE, borderRadius: SIZE / 2 }
            }
            transition={
              showHome
                ? {
                    y: { duration: 0.55, ease: EASE },
                    width: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                    height: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                    borderRadius: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                  }
                : {
                    width: { duration: 0.35, ease: "easeInOut" },
                    height: { duration: 0.35, ease: "easeInOut" },
                    borderRadius: { duration: 0.35, ease: "easeInOut" },
                    y: { duration: 0.45, ease: EASE },
                  }
            }
          >
            <motion.span
              className="text-background text-xs font-semibold select-none tracking-wide"
              initial={false}
              animate={
                showHome
                  ? { filter: "blur(0px)", opacity: 1, scale: 1 }
                  : { filter: "blur(10px)", opacity: 0, scale: 0.4 }
              }
              transition={showHome ? { duration: 0.45, delay: 0.18 } : { duration: 0.2 }}
            >
              <h2>Agent</h2>
            </motion.span>
          </motion.div>

          {/* Main circle with robot icon — HTML overlay */}
          <div
            className="bg-foreground rounded-full relative z-10 cursor-pointer flex items-center justify-center"
            style={{ width: SIZE, height: SIZE }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
            onClick={handleClick}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 32 25"
              fill="none"
              style={{ width: 30, height: 23 }}
            >
              <g clipPath="url(#clip0_43_40)">
                <path d="M1.94611 10.6821H3.67496V20.0375L3.61919 20.0928H2.00188L1.49996 19.9821L0.998034 19.65L0.774957 19.3732L0.607649 19.0411L0.55188 18.8196V11.9L0.774957 11.4018L1.16534 10.9589L1.6115 10.7375L1.94611 10.6821Z" fill="white"/>
                <path d="M28.325 10.6821H30.0538L30.6115 10.8482L31.0576 11.1803L31.3923 11.7339L31.448 12.0107V18.7089L31.2807 19.2625L30.9461 19.7053L30.5 19.9821L29.998 20.0928H28.325V10.6821Z" fill="white"/>
                <path d="M16.8369 0.994141L17.2266 1.32715L17.5059 1.8252L17.5615 2.10156L17.6172 4.37109L23.4727 4.42676L24.3652 4.59277L25.2578 5.03613L25.8154 5.47852L26.3174 6.03223L26.708 6.69629L26.9863 7.58203L27.042 8.02539V21.7539L26.9307 22.5283L26.6523 23.1924L26.1504 23.8574L25.5918 24.2998L24.9229 24.6318L24.1426 24.7979H7.74609L7.13281 24.6318L6.5752 24.4111L5.96191 23.9678L5.51562 23.4697L5.06934 22.584L4.95801 22.0303V7.85938L5.06934 7.30566L5.40332 6.47461L5.90527 5.75488L6.40723 5.25684L7.02148 4.86914L7.63477 4.59277L8.52734 4.42676L14.3828 4.37109L14.4385 2.04688L14.6055 1.54785L15.0518 1.0498L15.4424 0.828125L15.665 0.773438H16.2783L16.8369 0.994141ZM10.9805 11.9551L10.5342 12.1211L9.97656 12.5088L9.75391 12.7861L9.41895 13.3389L9.25195 14.0039V14.4463L9.36328 14.9443L9.64258 15.498L10.0332 15.9414L10.4785 16.2734L11.0928 16.4951H12.0957L12.4307 16.3838L12.877 16.1621L13.3789 15.7197L13.7139 15.2217L13.9365 14.502V13.8926L13.8809 13.6162L13.6582 13.1182L13.3232 12.6201L13.0439 12.3984L12.542 12.0664L11.873 11.9004H11.2598L10.9805 11.9551ZM20.127 11.9004L19.7363 11.9551L19.2344 12.1768L18.6211 12.6748L18.2861 13.1729L18.0635 13.8379V14.6123L18.1191 14.834L18.3984 15.4434L18.8447 15.9414L19.29 16.2734L19.9043 16.4951H20.8516L21.0752 16.4395L21.5771 16.2178L22.0234 15.8857L22.4697 15.332L22.6924 14.7236L22.748 14.0586L22.6367 13.5059L22.4131 13.0068L22.0791 12.6201L21.7998 12.3428L21.1865 12.0107L20.6289 11.9004H20.127Z" fill="white"/>
              </g>
              <defs>
                <clipPath id="clip0_43_40">
                  <rect width="32" height="25" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </div>
        </div>

        {/* Bouncing circles — inline SVG with filter on <g> for mobile Safari */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <svg
            viewBox={SVG_VB}
            style={{ position: "absolute", left: -PAD, top: -PAD, width: SVG_W, height: SVG_W, pointerEvents: "none" }}
          >
            <defs>
              <filter id="GooeyBouncingFilter" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -6" />
              </filter>
              <filter id="GooeyBouncingFilterM" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 15 -6" />
              </filter>
            </defs>
            <g filter={clicked ? (isMobile ? "url(#GooeyBouncingFilterM)" : "url(#GooeyBouncingFilter)") : undefined}>
              {BOUNCING_CIRCLES.map((c) => {
                const activeCx = CX + c.activeX;
                const activeCy = CY + c.y;
                const gatherCx = CX + 58;
                const gatherCy = CY;
                const mergeCx = CX;
                const mergeCy = CY;
                const r = c.size / 2;
                const isCenter = c.id === "center";

                return (
                  <React.Fragment key={c.id + "-svg"}>
                    {/* Pill removed from SVG layer! Now fully crisp in HTML overlay, preventing gooey bridges. */}
                    {/* Bouncing dot */}
                    <motion.rect
                      style={{ fill: FG }}
                      initial={false}
                      animate={
                        clicked === true
                          ? { x: activeCx - r, y: activeCy - r, width: c.size, height: c.size, rx: r, opacity: 1 }
                          : clicked === "entering"
                            ? { x: gatherCx, y: gatherCy, width: 0, height: 0, rx: 0, opacity: 1 }
                            : clicked === "closing"
                              ? { x: gatherCx - r, y: gatherCy - r, width: c.size, height: c.size, rx: r, opacity: 1 }
                              : clicked === "merging"
                                ? { x: mergeCx - r, y: mergeCy - r, width: c.size, height: c.size, rx: r, opacity: 0 }
                                : open
                                  ? { x: gatherCx, y: gatherCy, width: 0, height: 0, rx: 0, opacity: 0 }
                                  : { x: mergeCx, y: mergeCy, width: 0, height: 0, rx: 0, opacity: 0 }
                      }
                      transition={{
                        duration: clicked === "merging" ? 0.35 : (clicked === "closing" && !isCenter) ? 0.35 : 0.65,
                        ease: clicked === "closing" || clicked === "merging" ? [0.76, 0, 1, 1] : EASE,
                        delay: clicked === true ? c.delay : 0,
                        opacity: { duration: 0.1, delay: clicked === true ? c.delay : 0 },
                      }}
                    />
                  </React.Fragment>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Foreground Icons & Texts (Crisp, above gooey) — HTML overlay */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          {BOUNCING_CIRCLES.map((c) => (
            <div
              key={c.id + "-fg"}
              className="absolute flex items-center pointer-events-none"
              style={{ width: c.size, height: c.size, zIndex: c.id === "center" ? 2 : 1 }}
            >
              <motion.div
                className="absolute flex items-center justify-center w-full h-full rounded-full"
                style={{ pointerEvents: clicked === true ? "auto" : "none" }}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHoverDot(c.id); }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoverDot(null); }}
                initial={false}
                animate={
                  clicked === true
                    ? { x: c.activeX, y: c.y, scale: 1, opacity: 1 }
                    : clicked === "entering"
                      ? { x: 58, y: 0, scale: 0.5, opacity: 0 }
                      : clicked === "closing"
                        ? c.id === "center"
                          ? { x: 58, y: 0, scale: 1, opacity: 1 }
                          : { x: 58, y: 0, scale: 1, opacity: 0 }
                        : clicked === "merging"
                          ? { x: 0, y: 0, scale: 0, opacity: 0 }
                          : open
                            ? { x: 58, y: 0, scale: 0, opacity: 0 }
                            : { x: 0, y: 0, scale: 0, opacity: 0 }
                }
                transition={{
                  duration: (clicked === "closing" && c.id !== "center") ? 0.35 : 0.65, ease: EASE,
                  delay: clicked === true ? c.delay : 0,
                  opacity: { duration: 0.15, delay: clicked === true ? c.delay : 0 }
                }}
              >
                {c.icon}
                <motion.div
                  className="absolute flex items-center justify-center h-full left-0 overflow-hidden bg-foreground rounded-full"
                  style={{ zIndex: -10 }}
                  initial={false}
                  animate={
                    hoverDot === c.id && clicked === true
                      ? { x: c.pillX, width: c.pillWidth, opacity: 1 }
                      : clicked === "entering" || clicked === "closing" || clicked === true
                        ? { x: 0, width: c.size, opacity: 1 }
                        : { x: 0, width: c.size, opacity: 0 }
                  }
                  transition={{ duration: 0.6, ease: EASE }}
                >
                  <motion.span
                    className="text-background text-[11px] font-semibold tracking-wide whitespace-nowrap"
                    initial={false}
                    animate={{ opacity: hoverDot === c.id && clicked === true ? 1 : 0 }}
                    transition={{ duration: 0.3, delay: hoverDot === c.id && clicked === true ? 0.15 : 0 }}
                  >
                    {c.label}
                  </motion.span>
                </motion.div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── Profile Gooey Circle ─── */

const PROFILE_SIZE = 72;
const BOTTOM_SIZE = 64;

const PILL_WIDTH = 160;
const PILL_HEIGHT = 118;

const originalDots = [
  { size: 20, x: -12, y: -11, name: "David", avatar: "/images/avatar/david.webp", handle: "https://x.com/theumoru" },
  { size: 17, x: 13, y: -8, name: "Evil Rabbit", avatar: "/images/avatar/evil-rabbit.webp", handle: "https://x.com/evilrabbit_" },
  { size: 22, x: 0, y: 14, name: "Pran", avatar: "/images/avatar/pran.webp", handle: "https://x.com/pranathiperii" },
];

const extraDots = [
  { size: 20, x: 28, y: 12, name: "Anthony", avatar: "/images/avatar/anthony.webp", handle: "https://x.com/amorriscode" },
  { size: 22, x: 53, y: 7, name: "Phamous", avatar: "/images/avatar/phamous.webp", handle: "https://x.com/JohnPhamous" },
  { size: 22, x: -29, y: 11, name: "Boris", avatar: "/images/avatar/boris.webp", handle: "https://x.com/bcherny" },
  { size: 22, x: -28, y: -34, name: "Floguo", avatar: "/images/avatar/floguo.webp", handle: "https://x.com/floguo" },
  { size: 20, x: 52, y: -34, name: "Guillermo", avatar: "/images/avatar/guillermo.webp", handle: "https://x.com/rauchg" },
  { size: 17, x: 58, y: -14, name: "Guri", avatar: "/images/avatar/guri.webp", handle: "https://x.com/Gur__vi" },
  { size: 20, x: -58, y: 14, name: "Ileri", avatar: "/images/avatar/ileri.webp", handle: "https://x.com/pipe_dev" },
  { size: 17, x: 38, y: 31, name: "Manoela", avatar: "/images/avatar/manoela.webp", handle: "https://x.com/crnacura" },
  { size: 17, x: -41, y: 32, name: "Sydney", avatar: "/images/avatar/sydney.webp", handle: "https://x.com/likandokayombo" },
  { size: 22, x: -15, y: 37, name: "Pablo", avatar: "/images/avatar/pablo.webp", handle: "https://x.com/pablostanley" },
  { size: 17, x: 37, y: -11, name: "Pariola", avatar: "/images/avatar/pariola.webp", handle: "https://x.com/iPariola" },
  { size: 22, x: -47, y: -11, name: "Sonya", avatar: "/images/avatar/sonya.webp", handle: "https://x.com/sonyarap" },
  { size: 22, x: 14, y: 36, name: "Peter", avatar: "/images/avatar/peter.webp", handle: "https://x.com/steipete" },
  { size: 17, x: 29, y: -32, name: "Uche", avatar: "/images/avatar/uche.webp", handle: "https://x.com/uche2wavy" },
];

const ProfileGooey = () => {
  const isMobile = useIsMobile();
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const dismissingRef = useRef(false);
  const [tooltipName, setTooltipName] = useState("");
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipInArea, setTooltipInArea] = useState(false);
  const [slideDir, setSlideDir] = useState({ enter: { x: 0, y: "100%" }, exit: { x: 0, y: "-100%" } });
  const nameKeyRef = useRef(0);
  const handleClick = () => {
    if (expanded) {
      setExpanded(false);
      dismissingRef.current = true;
      // Stay in hovered state so pill morphs back to 3 dots first, then dismiss
      setTimeout(() => { dismissingRef.current = false; setHovered(false); }, 700);
    } else if (hovered) {
      setExpanded(true);
    } else {
      setHovered(true);
    }
  };

  const handleArrowClick = () => {
    setHovered(true);
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    if (!expanded && !dismissingRef.current) {
      setHovered(false);
    }
    setTooltipInArea(false);
  };

  const computeSlideDir = useCallback((e, el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    if (Math.abs(dx) > Math.abs(dy)) {
      const dir = dx > 0 ? "100%" : "-100%";
      setSlideDir({ enter: { x: dir, y: 0 }, exit: { x: dx > 0 ? "-100%" : "100%", y: 0 } });
    } else {
      const dir = dy > 0 ? "100%" : "-100%";
      setSlideDir({ enter: { x: 0, y: dir }, exit: { x: 0, y: dy > 0 ? "-100%" : "100%" } });
    }
  }, []);

  const handleDotMouseEnter = useCallback((e, name) => {
    if (!expanded) return;
    computeSlideDir(e, e.currentTarget);
    setTooltipName((prev) => {
      if (prev !== name) nameKeyRef.current += 1;
      return name;
    });
  }, [expanded, computeSlideDir]);

  const handleDotMouseMove = useCallback((e) => {
    if (!expanded) return;
    setTooltipPos({ x: e.clientX, y: e.clientY });
    setTooltipInArea(true);
  }, [expanded]);

  const handleDotMouseLeave = useCallback(() => {}, []);

  const handleContainerMouseMove = useCallback((e) => {
    if (!expanded) return;
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, [expanded]);

  const handleProfileMouseEnter = useCallback(() => {
    setHovered(true);
    setTooltipInArea(false);
  }, []);

  const showHover = hovered && !expanded;
  const repaintRef = useGooeyRepaint(isMobile, [hovered, expanded]);

  return (
    <div ref={repaintRef} className="flex w-full flex-col items-center justify-center relative">
      <div
        className="relative"
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') handleMouseLeave(); }}
        onMouseMove={handleContainerMouseMove}
        style={{ width: PROFILE_SIZE, height: PROFILE_SIZE }}
      >
        {/* Gooey group — inline SVG with filter on <g> for mobile Safari */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          <svg
            viewBox={PSVG_VB}
            style={{ position: "absolute", left: -PAD, top: -PAD, width: PSVG_W, height: PSVG_W, pointerEvents: "none" }}
          >
            <defs>
              <filter id="ProfileGooeyFilter" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 45 -18" />
              </filter>
              <filter id="ProfileGooeyFilterM" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 45 -18" />
              </filter>
            </defs>
            <g filter={isMobile ? "url(#ProfileGooeyFilterM)" : "url(#ProfileGooeyFilter)"}>
              {/* Profile backing — rect to match other rects */}
              <rect x={0} y={0} width={PROFILE_SIZE} height={PROFILE_SIZE} rx={PCX} style={{ fill: FG }} />

              {/* Bottom shape — circle on hover, pill on expanded */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  expanded
                    ? {
                        x: PCX - PILL_WIDTH / 2,
                        y: PCY + PROFILE_SIZE * 1.0 - PILL_HEIGHT / 2,
                        width: PILL_WIDTH,
                        height: PILL_HEIGHT,
                        rx: PILL_HEIGHT / 2,
                        opacity: 1,
                      }
                    : showHover
                      ? {
                          x: PCX - BOTTOM_SIZE / 2,
                          y: PCY + PROFILE_SIZE * 1.0 - BOTTOM_SIZE / 2,
                          width: BOTTOM_SIZE,
                          height: BOTTOM_SIZE,
                          rx: BOTTOM_SIZE / 2,
                          opacity: 1,
                        }
                      : { x: PCX - PROFILE_SIZE / 2, y: 0, width: PROFILE_SIZE, height: PROFILE_SIZE, rx: PCX, opacity: 0 }
                }
                transition={
                  expanded || showHover
                    ? { duration: 0.6, ease: EASE, opacity: { duration: 0.05 } }
                    : { duration: 0.25, ease: [0.76, 0, 1, 1], opacity: { duration: 0.05, delay: 0.2 } }
                }
              />

              {/* Arrow backing */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  expanded || hovered
                    ? { x: PCX - 11, y: PCY - 11, width: 22, height: 22, rx: 11, opacity: 0 }
                    : { x: PCX - 11, y: PCY + PROFILE_SIZE * 0.58 - 11, width: 22, height: 22, rx: 11, opacity: 1 }
                }
                transition={
                  expanded || hovered
                    ? { duration: 0.4, ease: EASE, opacity: { duration: 0.15 } }
                    : { duration: 0.4, ease: EASE, delay: 0.25, opacity: { duration: 0.15, delay: 0.25 } }
                }
              />

              {/* Team pill bg */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  expanded
                    ? { x: PCX - 40, y: PCY - 72 - 13, width: 80, height: 26, rx: 13 }
                    : { x: PCX - 13, y: PCY - 13, width: 26, height: 26, rx: 13 }
                }
                transition={
                  expanded
                    ? {
                        y: { duration: 0.55, ease: EASE },
                        width: { duration: 0.3, delay: 0.15, ease: "easeInOut" },
                      }
                    : {
                        width: { duration: 0.35, ease: "easeInOut" },
                        y: { duration: 0.55, ease: EASE, delay: 0.1 },
                      }
                }
              />
            </g>
          </svg>
        </div>

        {/* Arrow icon — outside gooey so it's visible */}
        <div className="absolute inset-0 flex items-center justify-center" style={{ pointerEvents: "none" }}>
          <motion.div
            className="absolute flex items-center justify-center cursor-pointer"
            style={{ pointerEvents: "auto" }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHovered(true); }}
            onClick={handleArrowClick}
            initial={false}
            animate={
              expanded || hovered
                ? { y: 0, width: 22, height: 22, opacity: 0 }
                : { y: PROFILE_SIZE * 0.58, width: 22, height: 22, opacity: 1 }
            }
            transition={
              expanded || hovered
                ? { duration: 0.4, ease: EASE, opacity: { duration: 0.15 } }
                : { duration: 0.4, ease: EASE, delay: 0.25, opacity: { duration: 0.15, delay: 0.25 } }
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-background"
              style={{ width: 12, height: 12 }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.div>
        </div>

        {/* 3 original circles — visible on hover AND expanded */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          {originalDots.map((dot, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-foreground overflow-hidden cursor-pointer"
              style={{ width: dot.size, height: dot.size, pointerEvents: "auto" }}
              initial={false}
              animate={{
                x: dot.x,
                y: PROFILE_SIZE * 1.0 + dot.y,
                scale: hovered ? 1 : 0,
                opacity: hovered ? 1 : 0,
              }}
              transition={{
                duration: !expanded && hovered ? 0.35 : 0.05,
                ease: !expanded && hovered ? "easeOut" : [0, 0, 0.58, 1],
                delay: !expanded && hovered ? 0.2 + i * 0.1 : (2 - i) * 0.07,
                opacity: {
                  duration: !expanded && hovered ? 0.15 : 0.1,
                  delay: !expanded && hovered ? 0.2 + i * 0.1 : (2 - i) * 0.07,
                },
              }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') handleDotMouseEnter(e, dot.name); }}
              onPointerMove={(e) => { if (e.pointerType === 'mouse') handleDotMouseMove(e); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') handleDotMouseLeave(); }}
              onClick={() => window.open(dot.handle, "_blank")}
            >
              <div className="w-full h-full rounded-full overflow-hidden lg:hover:scale-[0.85] transition-transform duration-150">
                <AvatarPlaceholder name={dot.name} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Extra dots — scale in one by one on expanded */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ pointerEvents: "none" }}
        >
          {extraDots.map((dot, i) => (
            <motion.div
              key={`extra-${i}`}
              className="absolute rounded-full bg-foreground overflow-hidden cursor-pointer"
              style={{ width: dot.size, height: dot.size, pointerEvents: "auto" }}
              initial={false}
              animate={{
                x: dot.x,
                y: PROFILE_SIZE * 1.0 + dot.y,
                scale: expanded ? 1 : 0,
                opacity: expanded ? 1 : 0,
              }}
              transition={{
                duration: 0.25,
                ease: "easeOut",
                delay: expanded ? 0.35 + i * 0.03 : 0,
                opacity: {
                  duration: 0.12,
                  delay: expanded ? 0.35 + i * 0.03 : 0,
                },
              }}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') handleDotMouseEnter(e, dot.name); }}
              onPointerMove={(e) => { if (e.pointerType === 'mouse') handleDotMouseMove(e); }}
              onPointerLeave={(e) => { if (e.pointerType === 'mouse') handleDotMouseLeave(); }}
              onClick={() => window.open(dot.handle, "_blank")}
            >
              <div className="w-full h-full rounded-full overflow-hidden lg:hover:scale-[0.85] transition-transform duration-150">
                <AvatarPlaceholder name={dot.name} />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Profile image — on top, outside gooey filter */}
        <div
          className="absolute inset-0 z-10 flex items-center justify-center cursor-pointer"
          onPointerEnter={(e) => { if (e.pointerType === 'mouse') handleProfileMouseEnter(); }}
          onClick={handleClick}
        >
          <div
            className="rounded-full overflow-hidden"
            style={{ width: PROFILE_SIZE - 8, height: PROFILE_SIZE - 8 }}
          >
            {/* Placeholder profile (real image omitted per spec) */}
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: "linear-gradient(135deg, hsl(265 70% 60%), hsl(210 70% 50%))" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style={{ width: 28, height: 28, opacity: 0.92 }}>
                <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6Z" />
              </svg>
            </div>
          </div>
        </div>

      </div>

      {/* Mouse-following tooltip */}
      {tooltipName && (
        <motion.div
          className="fixed z-50 pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 28,
            x: "-50%",
          }}
          initial={false}
          animate={{
            scale: tooltipInArea ? 1 : 0,
            opacity: tooltipInArea ? 1 : 0,
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="relative overflow-hidden rounded-full bg-foreground px-2.5 py-1">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={nameKeyRef.current}
                className="block text-[10px] font-medium text-background whitespace-nowrap"
                initial={{ x: slideDir.enter.x, y: slideDir.enter.y, opacity: 0 }}
                animate={{ x: 0, y: 0, opacity: 1 }}
                exit={{ x: slideDir.exit.x, y: slideDir.exit.y, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {tooltipName}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Team text — outside gooey, on top of the pill bg */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          className="absolute flex items-center justify-center overflow-hidden"
          initial={false}
          animate={
            expanded
              ? { y: -72, width: 50, height: 26 }
              : { y: 0, width: 26, height: 26 }
          }
          transition={
            expanded
              ? {
                  y: { duration: 0.55, ease: EASE },
                  width: { duration: 0.3, delay: 0.15, ease: "easeInOut" },
                }
              : {
                  width: { duration: 0.35, ease: "easeInOut" },
                  y: { duration: 0.55, ease: EASE, delay: 0.1 },
                }
          }
        >
          <motion.span
            className="text-background text-xs font-semibold select-none tracking-wide whitespace-nowrap"
            initial={false}
            animate={
              expanded
                ? { filter: "blur(0px)", opacity: 1, scale: 1 }
                : { filter: "blur(10px)", opacity: 0, scale: 0.4 }
            }
            transition={
              expanded ? { duration: 0.45, delay: 0.28 } : { duration: 0.25 }
            }
          >
            Team
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
};

const GooeySimple = ({ label = "Projects" }) => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const repaintRef = useGooeyRepaint(isMobile, [open]);

  return (
    <div ref={repaintRef} className="flex w-full flex-col items-center justify-center relative">
      <div className="relative" onPointerLeave={(e) => { if (e.pointerType === 'mouse') setOpen(false); }}>
        {/* Invisible hover extension */}
        <div className="absolute -right-6 -bottom-16 -left-6 -top-6" />

        {/* Gooey group — inline SVG with filter on <g> for mobile Safari */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: SIZE, height: SIZE }}
        >
          <svg
            viewBox={SVG_VB}
            style={{ position: "absolute", left: -PAD, top: -PAD, width: SVG_W, height: SVG_W, pointerEvents: "none" }}
          >
            <defs>
              <filter id="GooeySimpleFilter" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" />
              </filter>
              <filter id="GooeySimpleFilterM" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -6" />
              </filter>
            </defs>
            <g filter={isMobile ? "url(#GooeySimpleFilterM)" : "url(#GooeySimpleFilter)"}>
              {/* Name pill */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  open
                    ? { x: CX - 35, y: CY + 54 - 14, width: 70, height: 28, rx: 14, opacity: 1 }
                    : { x: CX - 14, y: CY, width: 28, height: 28, rx: 14, opacity: 0 }
                }
                transition={
                  open
                    ? {
                        y: { duration: 0.55, ease: EASE },
                        x: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        width: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        height: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        rx: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        opacity: { duration: 0.05 },
                      }
                    : {
                        width: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                        height: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                        rx: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                        x: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                        y: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                        opacity: { duration: 0.05, delay: 0.2 },
                      }
                }
              />
              {/* Main shape */}
              <rect x={0} y={0} width={SIZE} height={SIZE} rx={CX} style={{ fill: FG }} />
            </g>
          </svg>

          {/* HTML overlay — label text */}
          <motion.div
            className="absolute flex items-center justify-center overflow-hidden pointer-events-none"
            initial={false}
            animate={
              open
                ? { y: 54, width: 70, height: 28, borderRadius: 14 }
                : { y: CY / 2, width: 28, height: 28, borderRadius: 14 }
            }
            transition={
              open
                ? {
                    y: { duration: 0.55, ease: EASE },
                    width: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                    height: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                    borderRadius: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                  }
                : {
                    width: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                    height: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                    borderRadius: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                    y: { duration: 0.25, ease: [0.76, 0, 1, 1] },
                  }
            }
          >
            <motion.span
              className="text-background text-xs font-semibold select-none tracking-wide"
              initial={false}
              animate={
                open
                  ? { filter: "blur(0px)", opacity: 1, scale: 1 }
                  : { filter: "blur(10px)", opacity: 0, scale: 0.4 }
              }
              transition={open ? { duration: 0.45, delay: 0.18 } : { duration: 0.12 }}
            >
              <h2>{label}</h2>
            </motion.span>
          </motion.div>

          {/* Main circle with grid icon — HTML overlay */}
          <div
            className="bg-foreground rounded-full relative z-10 cursor-pointer flex items-center justify-center"
            style={{ width: SIZE, height: SIZE }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') setOpen(true); }}
            onClick={() => setOpen(!open)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              style={{ width: 22, height: 22 }}
            >
              <rect x="3" y="3" width="8" height="8" rx="1.5" />
              <rect x="13" y="3" width="8" height="8" rx="1.5" />
              <rect x="3" y="13" width="8" height="8" rx="1.5" />
              <rect x="13" y="13" width="8" height="8" rx="1.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};



const SEARCH_SIZE = 56;
const SCX = SEARCH_SIZE / 2; // 28
const SCY = SEARCH_SIZE / 2; // 28
const MIN_INPUT_W = 30;
const MAX_INPUT_W = 240;
const INPUT_H = 44;
const SEARCH_ARROW = 32;

const SEARCH_PAD_X = 140;
const SEARCH_PAD_TOP = 140;
const SEARCH_PAD_BOTTOM = 25; // Massive reduction to prevent extra page scroll!
const SEARCH_SVG_W = SEARCH_SIZE + SEARCH_PAD_X * 2;
const SEARCH_SVG_H = SEARCH_SIZE + SEARCH_PAD_TOP + SEARCH_PAD_BOTTOM;
const SEARCH_SVG_VB = `${-SEARCH_PAD_X} ${-SEARCH_PAD_TOP} ${SEARCH_SVG_W} ${SEARCH_SVG_H}`;

const measureTextWidth = (text) => {
  if (typeof document === "undefined" || !text) return 0;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
  return ctx.measureText(text).width;
};

const SearchGooey = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setIsTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 300);
  };

  const handleMouseEnter = () => {
    if (isSearching) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 350);
  };

  const handleMouseLeave = () => {
    if (!query && !isSearching) {
      setOpen(false);
    }
  };

  const handleSearchClick = () => {
    if (isSearching) return;
    if (open) {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    } else {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  };

  const handleArrowClick = (e) => {
    e.stopPropagation();
    if (!query || isSearching) return;
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
    }, 2000);
  };

  const measuredW = measureTextWidth(query) + 16;
  const textW = Math.max(MIN_INPUT_W, Math.min(measuredW, MAX_INPUT_W));
  const pillW = isSearching ? INPUT_H : (open ? textW + SEARCH_ARROW + 6 : SEARCH_SIZE);
  const repaintRef = useGooeyRepaint(isMobile, [open]);

  return (
    <div ref={repaintRef} className="flex w-full flex-col items-center justify-center relative">
      <div
        className="relative"
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') handleMouseLeave(); }}
      >
        {/* Invisible hover extension */}
        <div className="absolute -right-10 -bottom-6 -left-10 -top-20" />

        {/* Background blobs — inline SVG with filter on <g> for mobile Safari */}
        <div
          className="relative flex items-center justify-center pointer-events-none"
          style={{ width: SEARCH_SIZE, height: SEARCH_SIZE }}
        >
          <svg
            viewBox={SEARCH_SVG_VB}
            style={{
              position: "absolute",
              left: -SEARCH_PAD_X,
              top: -SEARCH_PAD_TOP,
              width: SEARCH_SVG_W,
              height: SEARCH_SVG_H,
              pointerEvents: "none",
            }}
          >
            <defs>
              <filter id="SearchGooeyFilter" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -11" />
              </filter>
              <filter id="SearchGooeyFilterM" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -11" />
              </filter>
            </defs>
            <g filter={isMobile ? "url(#SearchGooeyFilterM)" : "url(#SearchGooeyFilter)"}>
              {/* Input pill background */}
              <motion.rect
                style={{ fill: FG }}
                initial={false}
                animate={
                  open
                    ? { x: SCX - pillW / 2, y: SCY - 74 - INPUT_H / 2, width: pillW, height: INPUT_H, rx: INPUT_H / 2 }
                    : { x: 0, y: 0, width: SEARCH_SIZE, height: SEARCH_SIZE, rx: SCX }
                }
                transition={
                  open
                    ? {
                        y: { duration: 0.55, ease: EASE },
                        x: { duration: isTyping ? 0.05 : 0.45, ease: isTyping ? "easeOut" : EASE },
                        width: { duration: isTyping ? 0.05 : 0.45, ease: isTyping ? "easeOut" : EASE },
                        height: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                        rx: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                      }
                    : {
                        x: { duration: 0.35, ease: "easeInOut" },
                        width: { duration: 0.35, ease: "easeInOut" },
                        height: { duration: 0.35, ease: "easeInOut" },
                        rx: { duration: 0.35, ease: "easeInOut" },
                        y: { duration: 0.45, ease: EASE },
                      }
                }
              />
              {/* Main search shape */}
              <rect x={0} y={0} width={SEARCH_SIZE} height={SEARCH_SIZE} rx={SCX} style={{ fill: FG }} />
            </g>
          </svg>
        </div>

        {/* Foreground elements (Crisp, above gooey) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Input pill foreground contents */}
          <motion.div
            className="absolute flex items-center justify-end pointer-events-auto overflow-hidden"
            initial={false}
            animate={
              open
                ? { y: -74, width: pillW, height: INPUT_H, borderRadius: INPUT_H / 2 }
                : { y: 0, width: SEARCH_SIZE, height: SEARCH_SIZE, borderRadius: SEARCH_SIZE / 2 }
            }
            transition={
              open
                ? {
                    y: { duration: 0.55, ease: EASE },
                    width: { duration: isTyping ? 0.05 : 0.45, ease: isTyping ? "easeOut" : EASE },
                    height: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                    borderRadius: { duration: 0.4, delay: 0.12, ease: "easeInOut" },
                  }
                : {
                    width: { duration: 0.35, ease: "easeInOut" },
                    height: { duration: 0.35, ease: "easeInOut" },
                    borderRadius: { duration: 0.35, ease: "easeInOut" },
                    y: { duration: 0.45, ease: EASE },
                  }
            }
          >
            {/* Text input */}
            <motion.div
              className="flex-1 h-full overflow-hidden"
              initial={false}
              animate={open && !isSearching ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <input
                ref={inputRef}
                type="text"
                value={query}
                readOnly={isSearching}
                onChange={handleQueryChange}
                className="w-full h-full bg-transparent text-background text-sm font-medium pl-3 pr-0 outline-none"
                style={{ caretColor: "var(--background)" }}
              />
            </motion.div>

            {/* Arrow */}
            <motion.div
              className="shrink-0 flex items-center justify-center cursor-pointer pointer-events-auto"
              style={{ 
                width: SEARCH_ARROW, 
                height: SEARCH_ARROW, 
                borderRadius: SEARCH_ARROW / 2, 
                marginRight: (INPUT_H - SEARCH_ARROW) / 2
              }}
              initial={false}
              animate={open ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              transition={open ? { duration: 0.45, ease: EASE } : { duration: 0.1 }}
              onClick={handleArrowClick}
            >
              <motion.div
                className="w-full h-full bg-background rounded-full flex items-center justify-center overflow-hidden relative"
                whileTap={!isSearching ? { scale: 0.85 } : {}}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSearching ? (
                    <motion.div
                      key="loader"
                      initial={{ scale: 0.5, opacity: 0, rotate: -90 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      exit={{ scale: 0.5, opacity: 0, rotate: 90 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      className="absolute items-center justify-center flex"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-foreground animate-spin"
                        style={{ width: 14, height: 14 }}
                      >
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="arrow"
                      initial={{ scale: 0.5, opacity: 0, x: -10 }}
                      animate={{ scale: 1, opacity: 1, x: 0 }}
                      exit={{ scale: 0.5, opacity: 0, x: 10 }}
                      transition={{ duration: 0.3 }}
                      className="absolute items-center justify-center flex"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-foreground"
                        style={{ width: 14, height: 14 }}
                      >
                        <path d="M 9 6 L 15 12 L 9 18" />
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Main search icon */}
          <div
            className="absolute rounded-full z-10 cursor-pointer flex items-center justify-center pointer-events-auto"
            style={{ width: SEARCH_SIZE, height: SEARCH_SIZE }}
            onPointerEnter={(e) => { if (e.pointerType === 'mouse') handleMouseEnter(); }}
            onClick={handleSearchClick}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: 22, height: 22 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export { Gooey, ProfileGooey, GooeySimple, SearchGooey };
