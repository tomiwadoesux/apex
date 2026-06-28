"use client";

// The shared "Contact Us" experience — the trigger button, the glass popup, and
// the brand logo that physically FLIES from the header to the popup on open (and
// back on close). Both the landing page and the booking form mount this so the
// two stay identical (they used to drift because each page had its own copy).
//
// The flying logo is a FLIP move: a fixed clone rides ABOVE the frosted overlay
// from the header logo's slot to the popup's centre-top. The page owns the header
// logo (layout differs per page) and passes it in via `headerLogoRef`; this
// component measures it, hides it during the flight, and restores it on landing.

import { useState, useEffect, useRef, type ComponentType, type MouseEvent, type RefObject } from "react";
import Logo, { LOGO_W, LOGO_H } from "@/components/Logo";

// ---- icons ----
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TikTokIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.5 3c.32 2.04 1.62 3.62 3.5 3.92v2.45c-1.3 0-2.55-.42-3.6-1.16v6.36c0 3.18-2.58 5.73-5.7 5.73S5 17.65 5 14.47s2.58-5.73 5.7-5.73c.3 0 .6.02.88.07v2.5a3.2 3.2 0 1 0 2.32 3.08V3h2.6z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="m3.6 6.5 8.4 6 8.4-6" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

// A tappable contact detail. Tapping the text pops a TINY two-action menu right under
// it — the primary action (Call for a number, Send mail for an address) + Copy — kept
// compact and centred so it stays fully on-screen on mobile. Closes on outside tap.
function ContactDetail({
  kind,
  value,
  accent,
  isLight,
  className,
}: {
  kind: "mail" | "phone";
  value: string;
  accent: string;
  isLight: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const href = kind === "mail" ? `mailto:${value}` : `tel:${value.replace(/[^+\d]/g, "")}`;
  const PrimaryIcon = kind === "mail" ? MailIcon : PhoneIcon;
  const primaryLabel = kind === "mail" ? "Send mail" : "Call";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const copy = () => {
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setOpen(false);
    }, 1000);
  };

  const itemCls = `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium leading-none transition-colors ${
    isLight ? "text-neutral-700 hover:bg-neutral-900/[0.06]" : "text-white/80 hover:bg-white/10"
  }`;

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`group inline-flex items-center gap-1 tracking-tight transition-colors hover:opacity-70 ${className ?? ""}`}
        style={open ? { color: accent } : undefined}
      >
        <span className="underline decoration-[1.5px] decoration-neutral-300 underline-offset-[5px] transition-colors group-hover:decoration-neutral-500">
          {value}
        </span>
      </button>

      {/* tiny action menu — sits just under the text, above the rest of the card */}
      <span
        role="menu"
        className="absolute left-1/2 top-full z-[25] mt-2 flex items-center gap-0.5 rounded-xl border p-1 shadow-xl"
        style={{
          background: isLight ? "rgba(255,255,255,0.98)" : "rgba(28,30,38,0.98)",
          borderColor: isLight ? "rgba(12,18,34,0.08)" : "rgba(255,255,255,0.12)",
          opacity: open ? 1 : 0,
          transform: open ? "translateX(-50%) translateY(0) scale(1)" : "translateX(-50%) translateY(-4px) scale(0.95)",
          transformOrigin: "top center",
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 160ms ease-out, transform 160ms ease-out",
          whiteSpace: "nowrap",
        }}
      >
        <a href={href} className={itemCls} style={{ color: accent }} onClick={() => setOpen(false)}>
          <PrimaryIcon className="h-3.5 w-3.5" />
          {primaryLabel}
        </a>
        <span className="h-4 w-px" style={{ background: isLight ? "rgba(12,18,34,0.1)" : "rgba(255,255,255,0.14)" }} />
        <button type="button" className={itemCls} onClick={copy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </span>
  );
}

// The "Contact Us" trigger — a black slab with a faint top sheen and a phone icon.
// Matches the dark CTA slab used across the landing hero.
export function ContactButton({
  onClick,
  className,
}: {
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group pointer-events-auto relative inline-flex h-11 items-center gap-2.5 overflow-hidden rounded-lg border px-6 text-sm font-semibold tracking-wide transition-transform duration-150 active:translate-y-px ${className ?? ""}`}
      style={{
        background: "linear-gradient(180deg, #242424 0%, #090909 100%)",
        color: "#ffffff",
        borderColor: "rgba(255,255,255,0.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14)",
      }}
    >
      <PhoneIcon className="relative z-[1] h-4 w-4 shrink-0" />
      <span className="relative z-[1]">Contact Us</span>
    </button>
  );
}

export function ContactPopup({
  open,
  onClose,
  isLight,
  accent,
  headerLogoRef,
  logoSize = 32,
}: {
  open: boolean;
  onClose: () => void;
  isLight: boolean;
  accent: string;
  /** The header logo element the clone flies FROM (hidden during the flight). */
  headerLogoRef: RefObject<HTMLElement | null>;
  /** Header / clone glyph height in px (defaults to 32). */
  logoSize?: number;
}) {
  const popupLogoRef = useRef<HTMLDivElement>(null);
  const [flyShown, setFlyShown] = useState(false); // clone mounted (whole flight, both ways)
  const [flyToPopup, setFlyToPopup] = useState(false); // target: popup (true) / header (false)
  const [flyAnim, setFlyAnim] = useState(false); // transition armed (off for the first placement)
  const [headerPos, setHeaderPos] = useState<{ x: number; y: number } | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  const LOGO_PX_W = (logoSize * LOGO_W) / LOGO_H;
  const sub = isLight ? "text-neutral-500" : "text-white/50";

  const measureLogos = () => {
    const h = headerLogoRef.current?.getBoundingClientRect();
    const q = popupLogoRef.current?.getBoundingClientRect();
    if (h) setHeaderPos({ x: h.left, y: h.top });
    if (q) setPopupPos({ x: q.left, y: q.top });
  };

  // Drive the flying logo off the `open` prop. On open: measure both slots, hide the
  // header logo, mount the clone over the header, then on the next frames glide it to
  // the popup. On close: glide it back; it unmounts (and restores the header logo) on
  // transitionend.
  useEffect(() => {
    if (open) {
      measureLogos();
      if (headerLogoRef.current) headerLogoRef.current.style.visibility = "hidden";
      setFlyShown(true);
      setFlyAnim(false);
      setFlyToPopup(false);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setFlyAnim(true);
          setFlyToPopup(true);
        }),
      );
      return () => cancelAnimationFrame(raf);
    }
    setFlyAnim(true);
    setFlyToPopup(false);
  }, [open]);

  // Esc closes; keep the flying logo's target in sync on resize while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onResize = () => measureLogos();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      {/* Contact popup — frosts the page and floats a glass card. Click outside / × / Esc
          to close. The card IRISES open: a clip-path circle grows from its centre. */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className="fixed inset-0 z-[60] overflow-y-auto transition-opacity duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          backgroundColor: isLight ? "rgba(226,232,240,0.45)" : "rgba(10,12,16,0.55)",
        }}
      >
        {/* full-height flex wrapper centres the card on BOTH axes at every screen size */}
        <div className="flex min-h-full items-center justify-center p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Contact ApexRide"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-[28px] border px-7 pb-7 pt-12 text-center transition-[clip-path,opacity] duration-[460ms] ease-out"
            style={{
              background: isLight ? "#ffffff" : "#16181f",
              borderColor: isLight ? "rgba(12,18,34,0.08)" : "rgba(255,255,255,0.12)",
              boxShadow: isLight ? "0 40px 90px -20px rgba(15,23,42,0.28)" : "0 40px 90px -20px rgba(0,0,0,0.6)",
              color: isLight ? "#0c1222" : "#f3f5fa",
              clipPath: open ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)",
              WebkitClipPath: open ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)",
            }}
          >
            {/* logo slot — the flying clone settles here; reserves the glyph's footprint. */}
            <div
              ref={popupLogoRef}
              aria-hidden
              className="mx-auto mb-3"
              style={{ width: LOGO_PX_W, height: logoSize }}
            />

            <button
              onClick={onClose}
              aria-label="Close"
              className={`absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-lg leading-none ${
                isLight ? "text-neutral-500 hover:bg-neutral-900/5" : "text-white/55 hover:bg-white/10"
              }`}
            >
              ×
            </button>
            <h3 className="text-[1.45rem] font-semibold! leading-tight tracking-tight">Get in touch</h3>
            <p className={`mx-auto mt-2 max-w-[18rem] text-[13px] leading-relaxed ${sub}`}>
              Executive transport across Lagos and Abuja. Reach us anytime.
            </p>

            <div className="mt-5 flex flex-col items-center gap-2.5 text-[13px]">
              <ContactDetail kind="mail" value="contact@apexride.com" accent={accent} isLight={isLight} className="font-semibold" />
              <ContactDetail kind="phone" value="+234 801 234 5678" accent={accent} isLight={isLight} className="font-semibold" />
            </div>

            <div className="mx-auto mt-6 grid w-full grid-cols-2 gap-3">
              {[
                { label: "Instagram", Icon: InstagramIcon, href: "https://instagram.com/apexride", brand: "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)" },
                { label: "TikTok", Icon: TikTokIcon, href: "https://www.tiktok.com/@apexride", brand: "#0a0a0a" },
              ].map(({ label, Icon, href, brand }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className={`group flex items-center gap-3 rounded-2xl border px-3.5 py-3 transition-all duration-200 ${
                    isLight
                      ? "border-neutral-200 bg-neutral-50 hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white hover:shadow-md"
                      : "border-white/10 bg-white/[0.04] hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]"
                  }`}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-sm transition-transform duration-200 group-hover:scale-105"
                    style={{ background: brand }}
                  >
                    <Icon />
                  </span>
                  <span className={`text-[13px] font-semibold ${isLight ? "text-neutral-800" : "text-white/90"}`}>{label}</span>
                </a>
              ))}
            </div>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: isLight ? "rgba(12,18,34,0.09)" : "rgba(255,255,255,0.1)" }} />
              <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${sub}`}>or send a message</span>
              <span className="h-px flex-1" style={{ background: isLight ? "rgba(12,18,34,0.09)" : "rgba(255,255,255,0.1)" }} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = String(fd.get("name") || "");
                const phone = String(fd.get("phone") || "");
                const inquiry = String(fd.get("inquiry") || "");
                const body = `Name: ${name}\nPhone: ${phone}\n\n${inquiry}`;
                window.location.href = `mailto:contact@apexride.com?subject=${encodeURIComponent(
                  `Inquiry from ${name || "a guest"}`,
                )}&body=${encodeURIComponent(body)}`;
                onClose();
              }}
              className="grid grid-cols-2 gap-2.5 text-left"
            >
              {[
                { name: "name", type: "text", ph: "Name" },
                { name: "phone", type: "tel", ph: "Phone" },
              ].map((f) => (
                <input
                  key={f.name}
                  name={f.name}
                  type={f.type}
                  required
                  placeholder={f.ph}
                  className={`rounded-xl border px-3.5 py-3 text-sm outline-none transition-colors ${
                    isLight
                      ? "border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-[#2A4FD0] focus:bg-white focus:ring-2 focus:ring-[#2A4FD0]/15"
                      : "border-white/12 bg-white/[0.04] placeholder:text-white/35 focus:border-white/45"
                  }`}
                />
              ))}
              <textarea
                name="inquiry"
                rows={3}
                placeholder="Your inquiry"
                className={`col-span-2 resize-none rounded-xl border px-3.5 py-3 text-sm leading-relaxed outline-none transition-colors ${
                  isLight
                    ? "border-neutral-200 bg-neutral-50 text-neutral-900 placeholder:text-neutral-400 focus:border-[#2A4FD0] focus:bg-white focus:ring-2 focus:ring-[#2A4FD0]/15"
                    : "border-white/12 bg-white/[0.04] placeholder:text-white/35 focus:border-white/45"
                }`}
              />
              <button
                type="submit"
                className="col-span-2 mt-1 inline-flex h-11 items-center justify-center rounded-lg border text-sm font-semibold tracking-wide transition-[filter,transform] duration-150 hover:brightness-[1.05] active:translate-y-px"
                style={{
                  background: "linear-gradient(180deg, #3A60E0 0%, #2A4FD0 100%)",
                  color: "#ffffff",
                  borderColor: "rgba(15,32,110,0.5)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28)",
                }}
              >
                Send inquiry
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Flying logo — a fixed clone that rides ABOVE the frosted overlay from the
          header slot to the popup's centre-top on open, and back on close. */}
      {flyShown && headerPos && popupPos ? (
        <div
          aria-hidden
          onTransitionEnd={() => {
            if (!flyToPopup) {
              setFlyShown(false);
              if (headerLogoRef.current) headerLogoRef.current.style.visibility = "visible";
            }
          }}
          className="pointer-events-none fixed left-0 top-0 z-[70]"
          style={{
            transform: `translate(${(flyToPopup ? popupPos : headerPos).x}px, ${(flyToPopup ? popupPos : headerPos).y}px)`,
            transition: flyAnim ? "transform 560ms cubic-bezier(0.22,1,0.36,1)" : "none",
            willChange: "transform",
          }}
        >
          <Logo size={logoSize} color={isLight ? "#0c1222" : "#f3f5fa"} accent={accent} />
        </div>
      ) : null}
    </>
  );
}
