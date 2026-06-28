"use client";

import { useState, useEffect, useRef, type ReactNode, type CSSProperties, type TouchEvent as ReactTouchEvent } from "react";
import Logo from "@/components/Logo";
import { ContactPopup, ContactButton } from "@/components/ContactPopup";
import Image from "next/image";
import Link from "next/link";
import { gsap } from "gsap";
import { toPng } from "html-to-image";
import PickupMapEmbed from "@/components/map/PickupMapEmbed";
import { CARS as FLEET_CARS } from "@/components/fleet/data";
import { RidePass, type RideBooking } from "@/components/RideCard";
import type { Booking } from "@/lib/bookings";

type Mode = "light" | "dark";

interface LocationItem {
  id: string;
  name: string;
  subtitle: string;
  code: string;
  desc: string;
  coordinates: string;
}

const LOCATIONS: LocationItem[] = [
  {
    id: "lagos",
    name: "Lagos International Airport",
    subtitle: "Murtala Muhammed Airport (LOS) · Ikeja",
    code: "LOS",
    desc: "Primary aviation gateway serving Lagos. Convenient access to major business districts and hotels.",
    coordinates: "6.5770° N, 3.3211° E",
  },
  {
    id: "abuja",
    name: "Abuja International Airport",
    subtitle: "Nnamdi Azikiwe Airport (ABV) · Airport Rd",
    code: "ABV",
    desc: "Federal Capital Territory gateway. Features modern terminal facilities and direct links to Maitama.",
    coordinates: "9.0068° N, 7.2631° E",
  },
  {
    id: "vi",
    name: "Victoria Island Business Hub",
    subtitle: "Adeola Odeku Center · Victoria Island",
    code: "VIC",
    desc: "Financial heart of Lagos. Swift chauffeur connections to headquarter complexes and premium hotels.",
    coordinates: "6.4281° N, 3.4219° E",
  },
];

// Floating-island renders for the pickup-location cards (public/images/city):
// a DAY cut-out for light mode, a NIGHT/dusk one for dark. Keyed by location id.
const LOCATION_CITY_IMG: Record<string, { light: string; dark: string }> = {
  lagos: {
    light: "/images/city/hf_20260609_191835_10382fac-98f4-4f3f-bbc5-b18661d9cd13.webp",
    dark: "/images/city/hf_20260609_191641_778c656b-3c37-40dc-b8b6-fb969aa69c40.webp",
  },
  abuja: {
    light: "/images/city/hf_20260609_211859_cfbf3152-29e3-469c-8852-c925c9926b80.webp",
    dark: "/images/city/hf_20260609_212050_d98df3f4-df45-4dc1-b005-a168344cbae4.webp",
  },
  vi: {
    light: "/images/city/hf_20260609_214000_7ad9a240-b82c-4cf6-8804-6d3d9f859ffc.webp",
    dark: "/images/city/hf_20260609_214125_de3aa492-7fb6-42b6-a4bc-d3f0de8d54c7.webp",
  },
};

interface VehicleAngles {
  front: string;
  side: string;
  rear: string;
}

interface VehicleItem {
  name: string;
  year: string;
  class: string;
  rate: string;
  capacity: string;
  specs: string;
  details: string;
  // Image filenames in /public/images, by theme then camera angle.
  // `light` = darker car (reads against the light backdrop); `dark` = lighter car.
  img: { light: VehicleAngles; dark: VehicleAngles };
}

// The bookable fleet, sourced from the shared roster (src/components/fleet/data.ts)
// so the form always shows the REAL cars. The picker is image-led, so only cars
// that have photos are bookable here. Each folder has front/side/rear.webp (the
// odd one missing falls back to an angle that exists); there are no per-theme
// colour variants anymore, so light and dark share the same image.
const FLEET_NO_FRONT = new Set(["Mercedes S-Class"]);
const FLEET_NO_SIDE = new Set(["Rolls Royce Phantom", "Mercedes GLE 53 2023 Coupe"]);

function buildFleetVehicles(): VehicleItem[] {
  return FLEET_CARS.filter((c) => c.image).map((c) => {
    // "/images/cars/Range Rover Velar/side.webp" → "cars/Range Rover Velar"
    const dir = c.image!.replace(/^\/images\//, "").replace(/\/[^/]+$/, "");
    const folder = dir.split("/").pop() ?? "";
    const angles: VehicleAngles = {
      front: `${dir}/${FLEET_NO_FRONT.has(folder) ? "side" : "front"}.webp`,
      side: `${dir}/${FLEET_NO_SIDE.has(folder) ? "front" : "side"}.webp`,
      rear: `${dir}/rear.webp`,
    };
    const seatSpec = c.specs.find((s) => /seat/i.test(s));
    const seats = seatSpec ? parseInt(seatSpec, 10) : null;
    const otherSpecs = c.specs.filter((s) => !/seat/i.test(s));
    return {
      name: c.name,
      year: String(c.year),
      class: c.type,
      rate: c.type,
      capacity: seats ? `Can carry up to ${seats} passengers` : "Chauffeured",
      specs: otherSpecs.join(" · ") || c.type,
      details: `${c.type}. ${c.specs.join(", ")}.`,
      img: { light: angles, dark: angles },
    };
  });
}

const VEHICLES: VehicleItem[] = buildFleetVehicles();

// "2026-06-28" → "Sat, 28 Jun 2026" for the ride-pass card.
function formatCardDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// A saved booking → the shape the ride-pass card renders.
function bookingToRide(b: Booking): RideBooking {
  return {
    service: b.service,
    pickup: b.pickup,
    dropoff: b.dropoff,
    duration: b.duration,
    date: b.date,
    time: b.time,
    bookingRef: b.id,
    car: { name: b.car.name, klass: b.car.klass, side: { light: b.car.image ?? "", dark: b.car.image ?? "" } },
    passengerName: b.passenger.name || undefined,
    phone: b.passenger.phone || undefined,
    email: b.passenger.email || undefined,
  };
}

interface ServiceItem {
  id: string;
  name: string;
  desc: string;
  // Which of the two service screens this tier lives on:
  //  "duration" → Step 5 (6h / 12h / 24h / Multiple Days)
  //  "type"     → Step 6 (Custom / Interstate / Airport / Point-to-Point)
  // The booking is ONE pick overall — choosing on either screen replaces the other.
  group: "duration" | "type";
  // Length in hours for the fixed-duration tiers (used to auto-compute drop-off).
  // "multiday" has no fixed length — its drop-off comes from the day count input.
  durationHours?: number;
}

const SERVICES: ServiceItem[] = [
  { id: "6h", name: "6 Hours", desc: "Half-day chauffeur, billed as a fixed 6-hour block.", group: "duration", durationHours: 6 },
  { id: "12h", name: "12 Hours", desc: "Full-day chauffeur across a fixed 12-hour block.", group: "duration", durationHours: 12 },
  { id: "24h", name: "24 Hours", desc: "Round-the-clock chauffeur on call for a full day.", group: "duration", durationHours: 24 },
  { id: "multiday", name: "Multiple Days", desc: "Dedicated chauffeur across the number of days you choose.", group: "duration" },
  { id: "custom", name: "Custom", desc: "Bespoke itinerary — tell us exactly what you need.", group: "type" },
  { id: "interstate", name: "Interstate", desc: "Long-distance executive transit between states.", group: "type" },
  { id: "airport", name: "Airport Transfer", desc: "Flat-rate transfer to or from airport terminals.", group: "type" },
  { id: "point", name: "Point-to-Point", desc: "Direct executive transit between custom coordinates.", group: "type" },
];

const DURATION_SERVICES = SERVICES.filter((s) => s.group === "duration");
const TYPE_SERVICES = SERVICES.filter((s) => s.group === "type");

// Quick-add chips for the final step. Tapping one toggles a short line in the
// request notes so guests can fill in the common asks without typing.
const QUICK_REQUESTS = [
  "Meet and greet at arrivals",
  "Child seat needed",
  "Quiet ride preferred",
  "Bottled water on board",
  "Extra stop along the way",
  "Help with my luggage",
];

// Labels for the custom date/time picker on the Schedule step.
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// --- Simple Icon Pack ---
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="17" rx="2.5" />
      <line x1="3" y1="9.5" x2="21" y2="9.5" />
      <line x1="8" y1="2.5" x2="8" y2="6.5" />
      <line x1="16" y1="2.5" x2="16" y2="6.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7.5 12 12 15 14" />
    </svg>
  );
}

// One chevron used for the calendar month nav and the time spinners.
function Chevron({ dir, size = 16 }: { dir: "up" | "down" | "left" | "right"; size?: number }) {
  const points =
    dir === "up" ? "6 15 12 9 18 15"
      : dir === "down" ? "6 9 12 15 18 9"
        : dir === "left" ? "15 18 9 12 15 6"
          : "9 18 15 12 9 6";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points={points} />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="19" r="2.4" />
      <circle cx="18" cy="5" r="2.4" />
      <path d="M8.4 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.6" />
    </svg>
  );
}

function HeadlampOnIcon() {
  const BODY = "M31.875 1.875C37.7083 2.29167 49.375 7.5 49.375 19.375C49.375 31.25 37.7083 36.4583 31.875 36.875C27.5 36.875 25.625 34.75 25.625 26.25L25.625 12.5C25.625 4 27.5 1.875 31.875 1.875Z";
  const BEAMS = "M17.5 8.125L1.875 8.125M17.5 15.625L1.875 15.625M17.5 23.125L1.875 23.125M17.5 30.625L1.875 30.625";
  return (
    <svg width="22" height="16" viewBox="0 0 52 39" fill="none" stroke="currentColor" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={`${BEAMS} ${BODY}`} />
    </svg>
  );
}

function HeadlampOffIcon() {
  const BODY = "M31.875 1.875C37.7083 2.29167 49.375 7.5 49.375 19.375C49.375 31.25 37.7083 36.4583 31.875 36.875C27.5 36.875 25.625 34.75 25.625 26.25L25.625 12.5C25.625 4 27.5 1.875 31.875 1.875Z";
  return (
    <svg width="22" height="16" viewBox="0 0 52 39" fill="none" stroke="currentColor" strokeWidth="3.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path transform="translate(-11.5 0)" d={BODY} />
    </svg>
  );
}

const BG_GRADIENT: Record<Mode, string> = {
  light: "radial-gradient(120% 120% at 50% 50%, #e2e8f0 0%, #cbd5e1 60%, #94a3b8 100%)",
  dark: "radial-gradient(120% 120% at 50% 50%, #1c1c1c 0%, #0a0a0a 60%, #020202 100%)",
};

// Fades the outer left/right edges of the flanking car images so they melt away.
const EDGE_FADE = "linear-gradient(to right, transparent 0%, #000 22%, #000 78%, transparent 100%)";

// Car-Type carousel sizing. The active (center) car rests a touch smaller than
// full size; when a car arrives in the center it pops in larger first, then
// settles down to the resting scale.
const CAR_REST_SCALE = 0.85;
const CAR_POP_SCALE = 1.2;

// STEPS strictly matching user requirements:
// 1. Contact (Name, Phone, Email)
// 2. Pickup Location (3D carousel of black squares)
// 3. Destination (Destination input)
// 4. Car Type (Vehicle select)
// 5. Duration (6h / 12h / 24h / Multiple Days + day count)
// 6. Service (Trip type: Custom / Interstate / Airport / Point-to-Point)
// 7. Schedule (Pickup Date & Time; drop-off auto-derived from any duration)
// 8. Special Requests
const STEPS = [
  "Contact",
  "Pickup Location",
  "Destination",
  "Car Type",
  "Duration",
  "Service",
  "Schedule",
  "Requests"
];

const validateNigerianPhone = (phone: string) => {
  const cleaned = phone.replace(/[^\d+]/g, "");
  const regex = /^(?:\+234|234|0)[789]\d{9}$/;
  return regex.test(cleaned);
};

const validateEmail = (email: string) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
};

// Modern, clean, flat CTA button. Shadow and tactile textures have been removed
// in favor of a sleek brand-colored design.
const CtaButton = ({
  isLight,
  disabled = false,
  onClick,
  children,
  className = "",
  style,
}: {
  isLight: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => {
  if (disabled) {
    return (
      <button
        disabled
        className={`pointer-events-auto rounded-full h-10 px-7 text-xs font-semibold tracking-wider flex items-center justify-center opacity-35 cursor-not-allowed border border-neutral-500/20 bg-neutral-900/10 text-neutral-400 ${className}`}
        style={style}
      >
        {children}
      </button>
    );
  }

  const themeClasses = isLight
    ? "bg-[#00209C] hover:bg-[#001c8a] text-white"
    : "bg-[#FDBA16] hover:bg-[#e0a20f] text-neutral-900";

  return (
    <button
      onClick={onClick}
      className={`group pointer-events-auto relative overflow-hidden rounded-full h-10 px-7 text-xs font-semibold tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] flex items-center justify-center ${themeClasses} ${className}`}
      style={{ boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3)", ...style }} // soft white top sheen
    >
      <span className="relative z-10">{children}</span>
    </button>
  );
};

export default function BookingForm() {
  const [mode, setMode] = useState<Mode>("light");
  const [currentStep, setCurrentStep] = useState(0); // 0–7 form steps, 8 = success
  const [activeIndex, setActiveIndex] = useState(0); // Location carousel active index
  const [carIndex, setCarIndex] = useState(0); // Car-type carousel active index
  const [displayedVehicleName, setDisplayedVehicleName] = useState(VEHICLES[0].name);
  const [displayedVehicleDetails, setDisplayedVehicleDetails] = useState(VEHICLES[0]);
  const prevVehicle = VEHICLES[(carIndex - 1 + VEHICLES.length) % VEHICLES.length];

  const nextVehicle = VEHICLES[(carIndex + 1) % VEHICLES.length];
  const farNextVehicle = VEHICLES[(carIndex + 2) % VEHICLES.length];
  const incomingNextVehicle = VEHICLES[(carIndex + 3) % VEHICLES.length];
  const [leftVehicle, setLeftVehicle] = useState(nextVehicle);
  const [farLeftVehicle, setFarLeftVehicle] = useState(farNextVehicle);
  const [incomingVehicle, setIncomingVehicle] = useState(incomingNextVehicle);

  useEffect(() => {
    setLeftVehicle(nextVehicle);
    setFarLeftVehicle(farNextVehicle);
    setIncomingVehicle(incomingNextVehicle);
  }, [carIndex, nextVehicle, farNextVehicle, incomingNextVehicle]);

  const leftCarRef = useRef<HTMLDivElement>(null);
  const centerCarRef = useRef<HTMLDivElement>(null);
  const rightCarRef = useRef<HTMLDivElement>(null);
  const farLeftCarRef = useRef<HTMLDivElement>(null);
  const incomingCarRef = useRef<HTMLDivElement>(null);
  const carAnimRef = useRef(false);

  // Touch-swipe support for the location / car carousels on mobile.
  const swipeStartXRef = useRef<number | null>(null);
  const makeSwipeHandlers = (onSwipe: (dir: number) => void) => ({
    onTouchStart: (e: ReactTouchEvent) => {
      swipeStartXRef.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: ReactTouchEvent) => {
      if (swipeStartXRef.current === null) return;
      const dx = e.changedTouches[0].clientX - swipeStartXRef.current;
      swipeStartXRef.current = null;
      if (Math.abs(dx) > 40) onSwipe(dx < 0 ? 1 : -1);
    },
  });

  const backButtonContainerRef = useRef<HTMLDivElement>(null);
  const headerDividerRef = useRef<HTMLDivElement>(null);

  // Contact details
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phoneBlurred, setPhoneBlurred] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);

  const showPhoneError = phoneBlurred && contactPhone.trim() !== "" && !validateNigerianPhone(contactPhone);

  const emailAtIndex = contactEmail.indexOf('@');
  const emailHasAt = emailAtIndex !== -1;
  const emailHasDotAfterAt = emailHasAt && contactEmail.slice(emailAtIndex).includes('.');
  const showEmailError = (emailHasAt && !emailHasDotAfterAt) || (emailBlurred && contactEmail.trim() !== "" && !validateEmail(contactEmail));

  // Booking fields
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);
  const [destination, setDestination] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState(VEHICLES[0]);
  // ONE service choice overall, spread across two screens (Duration + Trip Type).
  // null until the user picks; choosing on either screen replaces the other.
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [multiDayCount, setMultiDayCount] = useState(""); // # of days for "Multiple Days"
  const [customTripText, setCustomTripText] = useState(""); // free text for "Custom"
  const [bookingDate, setBookingDate] = useState("");
  const [bookingTime, setBookingTime] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  // Schedule step: which path the guest chose, and which month the calendar shows.
  const [scheduleMode, setScheduleMode] = useState<"quick" | "custom" | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const [bookingId, setBookingId] = useState("");
  // After a successful submit we hold the saved booking + render its ride-pass card.
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const passCardRef = useRef<HTMLDivElement>(null); // the confirmation ride-pass card (for image export)

  const [contactOpen, setContactOpen] = useState(false);

  const [customCarOpen, setCustomCarOpen] = useState(false);
  const [customCarInput, setCustomCarInput] = useState("");
  const [customCarYear, setCustomCarYear] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [apiModels, setApiModels] = useState<string[]>([]);
  const [isCustomCar, setIsCustomCar] = useState(false);
  const [customCarName, setCustomCarName] = useState("");
  // Car handed over from the fleet page via /form?car=…&year=… — pre-selected on mount
  // and announced near the Next button until the user reaches the Car Type step.
  const [preselectedCar, setPreselectedCar] = useState<string | null>(null);

  // Custom pickup location ("Customize" popup on Step 2 — like the car "Other Options")
  const [customLocationOpen, setCustomLocationOpen] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState("");
  const [isCustomLocation, setIsCustomLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [locationPicked, setLocationPicked] = useState<{ name: string; full: string; lat: number; lng: number } | null>(null);
  const [locationSearching, setLocationSearching] = useState(false);
  const [customLocationLandmark, setCustomLocationLandmark] = useState(""); // nearby popular landmark (optional)
  const [locationLocating, setLocationLocating] = useState(false); // geolocation in progress
  const [locationError, setLocationError] = useState("");
  const customLocationInputRef = useRef<HTMLInputElement>(null);
  const skipLocationSearchRef = useRef(false);

  const customOverlayRef = useRef<HTMLDivElement>(null);
  const customCardRef = useRef<HTMLDivElement>(null);
  const customBlurProxyRef = useRef({ v: 0 });
  // The header logo the shared contact popup's clone flies from / back to.
  const logoContainerRef = useRef<HTMLDivElement>(null);

  const isLight = mode === "light";
  const accent = "#2A4FD0"; // brand blue — matches the landing page lockup + popup

  const selectedVehicleObj = isCustomCar ? selectedVehicle : VEHICLES[carIndex];
  const nextVehicleObj = VEHICLES[(carIndex + 1) % VEHICLES.length];
  const prevVehicleObj = VEHICLES[(carIndex - 1 + VEHICLES.length) % VEHICLES.length];
  const farLeftVehicleObj = VEHICLES[(carIndex + 2) % VEHICLES.length];
  const incomingVehicleObj = VEHICLES[(carIndex - 2 + VEHICLES.length) % VEHICLES.length];

  const cardBgStyle = isLight
    ? "bg-white/45 border-[#00209C]/20 backdrop-blur-md text-neutral-900"
    : "bg-neutral-950/25 border-[#FDBA16]/20 backdrop-blur-md text-white";

  // Shared input styling — matches the Contact step (borderless, bottom-border, accent on focus)
  const labelStyle = isLight
    ? "block text-xs font-semibold tracking-wide mb-2 font-josefin text-neutral-600"
    : "block text-xs font-semibold tracking-wide mb-2 font-josefin text-white/50";

  const inputStyle = isLight
    ? "w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin transition-colors duration-300 focus:outline-none border-neutral-900/25 text-neutral-900 placeholder-neutral-900/35 focus:border-[#00209C]"
    : "w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin transition-colors duration-300 focus:outline-none border-white/15 text-white placeholder-white/25 focus:border-[#FDBA16]";

  const modalInputStyle = isLight
    ? "w-full px-4 py-3 rounded-xl bg-neutral-950/[0.03] border border-neutral-900/10 text-sm font-josefin transition-all duration-300 focus:outline-none focus:bg-white focus:border-[#00209C] focus:ring-1 focus:ring-[#00209C] text-neutral-900 placeholder-neutral-900/35"
    : "w-full px-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-sm font-josefin transition-all duration-300 focus:outline-none focus:bg-neutral-900 focus:border-[#FDBA16] focus:ring-1 focus:ring-[#FDBA16] text-white placeholder-white/25";

  const textareaStyle = isLight
    ? "w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin leading-relaxed resize-none transition-colors duration-300 focus:outline-none border-neutral-900/25 text-neutral-900 placeholder-neutral-900/35 focus:border-[#00209C]"
    : "w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin leading-relaxed resize-none transition-colors duration-300 focus:outline-none border-white/15 text-white placeholder-white/25 focus:border-[#FDBA16]";

  const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatTimeInput = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  // Friendly, readable versions for confirmation summaries (the inputs stay ISO).
  const formatHumanDate = (value: string) => {
    if (!value) return "";
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const formatHumanTime = (value: string) => {
    if (!value) return "";
    const [h, m] = value.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return "";
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
  };

  const roundedHoursFromNow = (hours: number) => {
    const date = new Date();
    date.setHours(date.getHours() + hours, 0, 0, 0);
    return date;
  };

  const tomorrowAt = (hour: number) => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const nextWeekendAt = (dayOffset: 0 | 1, hour: number) => {
    const date = new Date();
    const day = date.getDay();
    const daysUntilNextSaturday = day === 6 ? 7 : day === 0 ? 6 : 6 - day;
    date.setDate(date.getDate() + daysUntilNextSaturday + dayOffset);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const applyPickupDate = (date: Date) => {
    setBookingDate(formatDateInput(date));
    setBookingTime(formatTimeInput(date));
  };

  // --- Custom date/time picker (Schedule step) ---

  // Switching into the "Choose Date & Time" path: seed a sensible default time so
  // the summary can resolve, and jump the calendar to the already-chosen month.
  const enterCustomSchedule = () => {
    setScheduleMode("custom");
    if (!bookingTime) setBookingTime("12:00");
    if (bookingDate) {
      const d = new Date(`${bookingDate}T00:00:00`);
      if (!Number.isNaN(d.getTime())) setCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  };

  const todayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Cells for the visible month: leading nulls pad the first week to the weekday.
  const calendarCells = (() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const startOffset = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  })();

  // Don't let the calendar page back past the current month.
  const canGoPrevMonth = (() => {
    const now = new Date();
    return calendarMonth > new Date(now.getFullYear(), now.getMonth(), 1);
  })();
  const shiftMonth = (delta: number) =>
    setCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  // Time spinner — wheels are independent (no carry), composed back to "HH:MM".
  const parsedTime = (() => {
    const [h, m] = (bookingTime || "12:00").split(":").map(Number);
    return { h: Number.isNaN(h) ? 12 : h, m: Number.isNaN(m) ? 0 : m };
  })();
  const timePeriod: "AM" | "PM" = parsedTime.h >= 12 ? "PM" : "AM";
  const timeHour12 = parsedTime.h % 12 === 0 ? 12 : parsedTime.h % 12;
  const commitTime = (h24: number, m: number) =>
    setBookingTime(`${String((h24 + 24) % 24).padStart(2, "0")}:${String((m + 60) % 60).padStart(2, "0")}`);
  const to24 = (h12: number, period: "AM" | "PM") => (period === "PM" ? (h12 % 12) + 12 : h12 % 12);
  const stepHour = (delta: number) => {
    const next = ((timeHour12 - 1 + delta + 12) % 12) + 1;
    commitTime(to24(next, timePeriod), parsedTime.m);
  };
  const stepMinute = (delta: number) => commitTime(parsedTime.h, parsedTime.m + delta * 5);
  const setPeriod = (period: "AM" | "PM") => commitTime(to24(timeHour12, period), parsedTime.m);

  // Quick-request chips: each toggles its phrase as one line in the notes field,
  // staying within the 500-char cap shared with free-typed text.
  const isQuickRequestActive = (phrase: string) =>
    specialRequests.split("\n").some((l) => l.trim().toLowerCase() === phrase.toLowerCase());

  const toggleQuickRequest = (phrase: string) => {
    setSpecialRequests((prev) => {
      const lines = prev.split("\n").map((l) => l.trim()).filter(Boolean);
      const idx = lines.findIndex((l) => l.toLowerCase() === phrase.toLowerCase());
      if (idx !== -1) {
        lines.splice(idx, 1);
        return lines.join("\n");
      }
      const next = [...lines, phrase].join("\n");
      return next.length > 500 ? prev : next;
    });
  };

  const pickupOptions = [
    { label: "In 2 hours", helper: "Earliest standard pickup", date: roundedHoursFromNow(2) },
    { label: "In 4 hours", helper: "Later today", date: roundedHoursFromNow(4) },
    { label: "Tomorrow AM", helper: "9:00 pickup", date: tomorrowAt(9) },
    { label: "Tomorrow PM", helper: "18:00 pickup", date: tomorrowAt(18) },
    { label: "Next Saturday", helper: "Weekend 10:00", date: nextWeekendAt(0, 10) },
    { label: "Next Sunday", helper: "Weekend 12:00", date: nextWeekendAt(1, 12) },
  ];

  // The drop-off is derived from the chosen duration: fixed tiers add their hours
  // to the pickup; "Multiple Days" adds the day count. Trip-type tiers (custom /
  // interstate / airport / point) have no duration, so there's no auto drop-off.
  const multiDayNum = parseInt(multiDayCount, 10);
  const hasMultiDay = selectedService?.id === "multiday" && !Number.isNaN(multiDayNum) && multiDayNum >= 1;
  const isFixedDuration = selectedService?.group === "duration" && typeof selectedService.durationHours === "number";
  const computeAutoEnd = () => {
    if (!bookingDate || !bookingTime) return null;
    const start = new Date(`${bookingDate}T${bookingTime}`);
    if (Number.isNaN(start.getTime())) return null;
    if (isFixedDuration && selectedService?.durationHours) {
      return new Date(start.getTime() + selectedService.durationHours * 60 * 60 * 1000);
    }
    if (hasMultiDay) {
      const end = new Date(start.getTime());
      end.setDate(end.getDate() + multiDayNum);
      return end;
    }
    return null;
  };
  const autoEnd = computeAutoEnd();

  const scheduleSummary = (() => {
    if (!bookingDate || !bookingTime) return "Not selected";
    const start = `${bookingDate} @ ${bookingTime}`;
    if (autoEnd && hasMultiDay) return `${start} → ${formatDateInput(autoEnd)} (${multiDayNum} day${multiDayNum > 1 ? "s" : ""})`;
    if (autoEnd && isFixedDuration) return `${start} → ${formatDateInput(autoEnd)} @ ${formatTimeInput(autoEnd)} (${selectedService?.durationHours}h)`;
    return start;
  })();

  // One-line label for the chosen service across both screens (used in the review).
  const serviceSummary = !selectedService
    ? "Not selected"
    : selectedService.id === "multiday"
      ? `Multiple Days${multiDayCount.trim() ? ` · ${multiDayCount.trim()} day${multiDayNum > 1 ? "s" : ""}` : ""}`
      : selectedService.id === "custom"
        ? `Custom${customTripText.trim() ? ` · ${customTripText.trim()}` : ""}`
        : selectedService.name;

  // Per-section completeness for the Review step (Step 8). Red = needs attention,
  // green = done. Pickup / Vehicle default to a value, so they read as done.
  const contactComplete =
    contactName.trim() !== "" && validateNigerianPhone(contactPhone) && validateEmail(contactEmail);
  const pickupComplete = !!(selectedLocation?.name || (isCustomLocation && locationPicked));
  const vehicleComplete = !!selectedVehicle?.name;
  const serviceComplete =
    !!selectedService &&
    (selectedService.id === "multiday"
      ? multiDayNum >= 1
      : selectedService.id === "custom"
        ? customTripText.trim() !== ""
        : true);
  const scheduleComplete = bookingDate !== "" && bookingTime !== "";
  const allRequiredComplete =
    contactComplete && pickupComplete && vehicleComplete && serviceComplete && scheduleComplete;
  // Status colours for the review chips.
  const okColor = isLight ? "#15803d" : "#4ade80";
  const badColor = isLight ? "#dc2626" : "#f87171";

  // Shared renderer for a service tier card (used by both the Duration and Trip
  // Type screens). The booking is one pick overall, so selection is keyed on the
  // single `selectedService` — choosing a card on either screen replaces the other.
  const renderTierCard = (srv: ServiceItem) => {
    const isSelected = selectedService?.id === srv.id;
    const badgeLabel = srv.group === "duration"
      ? (srv.id === "multiday" ? "Extended" : "Fixed Duration")
      : (srv.id === "custom" ? "Flexible" : "Trip Type");
    const cardStyle = isSelected
      ? isLight
        ? "bg-[#00209C] border-[#00209C] text-white shadow-xl shadow-indigo-500/10 scale-[1.03]"
        : "bg-neutral-900 border-[#FDBA16] text-white shadow-2xl scale-[1.03]"
      : isLight
        ? "bg-white/45 border-neutral-900/10 text-neutral-800 hover:border-neutral-900/25 hover:scale-[1.01] backdrop-blur-md"
        : "bg-neutral-950/20 border-white/10 text-white/70 hover:border-white/30 hover:scale-[1.01] backdrop-blur-md";
    const badgeStyle = isSelected ? "text-white/70" : isLight ? "text-neutral-900/40" : "text-white/40";
    const nameStyle = `font-light ${isSelected ? "text-white" : isLight ? "text-neutral-900" : "text-white"}`;
    const descStyle = `font-light ${isSelected ? "text-white/60" : isLight ? "text-neutral-900/50" : "text-white/50"}`;
    return (
      <button
        key={srv.id}
        onClick={() => setSelectedService(srv)}
        className={`relative flex h-full flex-col p-4 sm:p-5 rounded-2xl border text-left transition-all duration-300 shadow-lg ${cardStyle}`}
      >
        <div className={`text-[9px] sm:text-[10px] uppercase font-bold tracking-widest ${badgeStyle}`}>{badgeLabel}</div>
        <h2 className={`text-base sm:text-lg tracking-tight mt-1.5 ${nameStyle}`}>{srv.name}</h2>
        <p className={`text-[11px] leading-relaxed mt-2 ${descStyle}`}>{srv.desc}</p>
        {isSelected && (
          <span className={`absolute right-3 top-3 rounded-full p-1 ${isLight ? "bg-white text-[#00209C]" : "bg-[#FDBA16] text-neutral-950"}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
        )}
      </button>
    );
  };

  const [displayedStepText, setDisplayedStepText] = useState("Step 1 of 8");
  const [displayedSubLabel, setDisplayedSubLabel] = useState("Provide Your Contact Information");

  const getSubLabelText = (step: number) => {
    switch (step) {
      case 0: return "Provide Your Contact Information";
      case 1: return selectedLocation?.name || "Lagos International Airport";
      case 2: return "Enter Booking Destination";
      case 3: return "Select Your Premium Vehicle";
      case 4: return "Choose Service Duration";
      case 5: return "Choose Trip Type";
      case 6: return "Choose Pickup Date & Time";
      case 7: return "Any Special Requests?";
      default: return "";
    }
  };

  useEffect(() => {
    if (currentStep <= 7) {
      const newText = currentStep === 3 ? "Step 4 of 8 | Select a Car" : `Step ${currentStep + 1} of 8`;
      const newSubLabel = getSubLabelText(currentStep);

      if (displayedStepText === newText && displayedSubLabel === newSubLabel) return;

      const targets = document.querySelectorAll(".step-text, .sub-step-text, .heading-vehicle-info");
      if (targets.length > 0) {
        gsap.to(targets, {
          opacity: 0,
          y: -10,
          filter: "blur(6px)",
          webkitFilter: "blur(6px)",
          duration: 0.15,
          ease: "power2.in",
          onComplete: () => {
            setDisplayedStepText(newText);
            setDisplayedSubLabel(newSubLabel);
          }
        });
      } else {
        setDisplayedStepText(newText);
        setDisplayedSubLabel(newSubLabel);
      }
    }
  }, [currentStep, selectedLocation?.name]);

  useEffect(() => {
    const targets = document.querySelectorAll(".step-text, .sub-step-text, .heading-vehicle-info");

    if (targets.length > 0) {
      gsap.set(targets, {
        opacity: 0,
        y: 10,
        filter: "blur(6px)",
        webkitFilter: "blur(6px)"
      });
      gsap.to(targets, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        webkitFilter: "blur(0px)",
        duration: 0.35,
        stagger: 0.05,
        ease: "power2.out"
      });
    }
  }, [displayedStepText, displayedSubLabel]);

  // Header back button sliding and vertical divider clipmask reveal animation
  useEffect(() => {
    const btn = backButtonContainerRef.current;
    const div = headerDividerRef.current;
    if (!btn || !div) return;

    const hasBack = currentStep > 0 && currentStep <= 7;

    if (hasBack) {
      gsap.killTweensOf([btn, div]);
      gsap.to(btn, {
        width: "60px",
        opacity: 1,
        x: 0,
        duration: 0.45,
        ease: "power2.out"
      });
      gsap.fromTo(div,
        { clipPath: "inset(0% 0% 100% 0%)", opacity: 0 },
        {
          clipPath: "inset(0% 0% 0% 0%)",
          opacity: 1,
          duration: 0.45,
          ease: "power2.out",
          delay: 0.1
        }
      );
    } else {
      gsap.killTweensOf([btn, div]);
      gsap.to(btn, {
        width: 0,
        opacity: 0,
        x: -15,
        duration: 0.35,
        ease: "power2.in"
      });
      gsap.to(div, {
        clipPath: "inset(0% 0% 100% 0%)",
        opacity: 0,
        duration: 0.35,
        ease: "power2.in"
      });
    }
  }, [currentStep]);

  // Sync selected location state to active carousel card (unless a custom one is set)
  useEffect(() => {
    if (currentStep === 1 && !isCustomLocation) {
      setSelectedLocation(LOCATIONS[activeIndex]);
    }
  }, [activeIndex, currentStep, isCustomLocation]);

  // Focus the address field when the Customize popup opens
  useEffect(() => {
    if (customLocationOpen) {
      customLocationInputRef.current?.focus();
    }
  }, [customLocationOpen]);

  // Live address search via our OpenStreetMap proxy (/api/geocode), debounced.
  // Same-origin so it isn't blocked by CORS or ad-blockers; min 3 chars, aborts.
  useEffect(() => {
    if (!customLocationOpen) return;
    if (skipLocationSearchRef.current) {
      skipLocationSearchRef.current = false; // change came from picking a result
      return;
    }
    const q = customLocationInput.trim();
    const controller = new AbortController();
    // All state updates happen inside the debounced callback (async), so the
    // effect body itself never calls setState synchronously.
    const t = setTimeout(() => {
      if (q.length < 3) {
        setLocationResults([]);
        setLocationSearching(false);
        return;
      }
      setLocationSearching(true);
      fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data) => setLocationResults(Array.isArray(data) ? data : []))
        .catch(() => { /* aborted or network error — leave prior results */ })
        .finally(() => setLocationSearching(false));
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [customLocationInput, customLocationOpen]);

  useEffect(() => {
    if (currentStep === 3) {
      if (isCustomCar && customCarName) {
        // Already set custom car object details
      } else {
        setSelectedVehicle(VEHICLES[carIndex]);
      }
    }
    if (centerCarRef.current && leftCarRef.current && rightCarRef.current && farLeftCarRef.current && incomingCarRef.current) {
      if (isCustomCar) {
        // Active space is empty (opacity 0)
        gsap.set(centerCarRef.current, {
          transform: `translateX(0%) scale(${CAR_REST_SCALE}) scaleX(-1)`,
          opacity: 0,
          filter: "blur(0px)",
          webkitFilter: "blur(0px)"
        });
        // Two cars by the right
        gsap.set(leftCarRef.current, {
          transform: "translateX(85%) scale(0.35) scaleX(-1)",
          opacity: 0.9,
          filter: "blur(12px)",
          webkitFilter: "blur(12px)"
        });
        gsap.set(rightCarRef.current, {
          transform: "translateX(120%) scale(0.10) scaleX(-1)",
          opacity: 0.75,
          filter: "blur(28px)",
          webkitFilter: "blur(28px)"
        });
        gsap.set(farLeftCarRef.current, {
          transform: "translateX(-120%) scale(0.10) scaleX(-1)",
          opacity: 0,
          filter: "blur(28px)",
          webkitFilter: "blur(28px)"
        });
        gsap.set(incomingCarRef.current, {
          transform: "translateX(120%) scale(0.10) scaleX(-1)",
          opacity: 0,
          filter: "blur(28px)",
          webkitFilter: "blur(28px)"
        });
      } else {
        // Unilateral layout (original)
        gsap.set(centerCarRef.current, {
          transform: `translateX(0%) scale(${CAR_REST_SCALE}) scaleX(-1)`,
          opacity: 1,
          filter: "blur(0px)",
          webkitFilter: "blur(0px)"
        });
        gsap.set(leftCarRef.current, {
          transform: "translateX(-70%) scale(0.24) scaleX(-1)",
          opacity: 0.9,
          filter: "blur(12px)",
          webkitFilter: "blur(12px)"
        });
        gsap.set(farLeftCarRef.current, {
          transform: "translateX(-92%) scale(0.08) scaleX(-1)",
          opacity: 0.75,
          filter: "blur(28px)",
          webkitFilter: "blur(28px)"
        });
        gsap.set(incomingCarRef.current, {
          transform: "translateX(-102%) scale(0.02) scaleX(-1)",
          opacity: 0,
          filter: "blur(28px)",
          webkitFilter: "blur(28px)"
        });
        gsap.set(rightCarRef.current, {
          opacity: 0
        });
      }
    }
  }, [carIndex, currentStep, isCustomCar]);

  // Pre-select a car passed in from the fleet page (/form?car=Name&year=2024). If the
  // name matches one of our standard VEHICLES we lock the carousel onto it; otherwise we
  // treat it as a bespoke "fleet selection" via the existing custom-car path. Either way
  // the car is already chosen by the time the user reaches the Car Type step.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const carParam = params.get("car");
    if (!carParam) return;
    const yearParam = params.get("year") || "";
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(carParam);
    const matchIdx = VEHICLES.findIndex((v) => {
      const vn = norm(v.name);
      return vn === target || target.startsWith(vn) || vn.startsWith(target);
    });
    if (matchIdx >= 0) {
      setCarIndex(matchIdx);
      setIsCustomCar(false);
      setDisplayedVehicleName(VEHICLES[matchIdx].name);
      setDisplayedVehicleDetails(VEHICLES[matchIdx]);
      setSelectedVehicle(VEHICLES[matchIdx]);
      setPreselectedCar(VEHICLES[matchIdx].name);
    } else {
      const nameWithYear = yearParam ? `${carParam} (${yearParam})` : carParam;
      const customObj = {
        name: nameWithYear,
        year: yearParam || "2025",
        class: "From Our Fleet",
        rate: "Quote on Request",
        capacity: "Capacity confirmed after review",
        specs: "Fleet Selection",
        details: `Selected from our fleet: ${carParam}.`,
        img: {
          light: { front: "", side: "", rear: "" },
          dark: { front: "", side: "", rear: "" },
        },
      };
      setIsCustomCar(true);
      setCustomCarName(nameWithYear);
      setDisplayedVehicleName(nameWithYear);
      setSelectedVehicle(customObj);
      setDisplayedVehicleDetails(customObj);
      setPreselectedCar(nameWithYear);
    }
  }, []);

  // Animate the car details (name and specifications) when entering the vehicle selection step (Step 4)
  useEffect(() => {
    if (currentStep === 3) {
      const nameText = document.querySelectorAll(".car-name-text, .car-detail-text");
      if (nameText.length > 0) {
        gsap.set(nameText, {
          opacity: 0,
          y: 15,
          filter: "blur(8px)",
          webkitFilter: "blur(8px)"
        });
        gsap.to(nameText, {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          webkitFilter: "blur(0px)",
          duration: 0.45,
          stagger: 0.06,
          ease: "power2.out"
        });
      }
      // The main car pops in large, then settles to its resting size.
      if (centerCarRef.current && !isCustomCar) {
        gsap.fromTo(
          centerCarRef.current,
          { transform: `translateX(0%) scale(${CAR_POP_SCALE}) scaleX(-1)`, opacity: 0 },
          { transform: `translateX(0%) scale(${CAR_REST_SCALE}) scaleX(-1)`, opacity: 1, duration: 0.6, ease: "power3.out" }
        );
      }
    }
  }, [currentStep, isCustomCar]);

  // Transition between cars: Symmetrical bidirectional sliding
  const spinCar = (dir: number) => {
    if (isCustomCar) {
      setIsCustomCar(false);
      return;
    }
    const C = centerCarRef.current;
    const L = leftCarRef.current;
    const R = rightCarRef.current;
    const FL = farLeftCarRef.current;
    const IN = incomingCarRef.current;
    if (!C || !L || !FL || !IN || carAnimRef.current) return;
    carAnimRef.current = true;
    const target = (carIndex + dir + VEHICLES.length) % VEHICLES.length;

    // If dir is -1 (previous), we instantly update leftVehicle, farLeftVehicle and incomingVehicle
    // so they show the correct incoming cars.
    if (dir === -1) {
      setLeftVehicle(VEHICLES[target]);
      setFarLeftVehicle(VEHICLES[(target + 1) % VEHICLES.length]);
      setIncomingVehicle(VEHICLES[(target + 2) % VEHICLES.length]);
    }

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setCarIndex(target);
      setDisplayedVehicleName(VEHICLES[target].name);
      setDisplayedVehicleDetails(VEHICLES[target]);
      setLeftVehicle(VEHICLES[(target + 1) % VEHICLES.length]);
      setFarLeftVehicle(VEHICLES[(target + 2) % VEHICLES.length]);
      setIncomingVehicle(VEHICLES[(target + 3) % VEHICLES.length]);
      carAnimRef.current = false;
      return;
    }

    const nameText = document.querySelectorAll(".car-name-text, .car-detail-text");

    const tl = gsap.timeline({
      onComplete: () => {
        // Swap index state
        setCarIndex(target);
        carAnimRef.current = false;
      }
    });

    // Ensure rightCarRef is hidden
    if (R) {
      gsap.set(R, { opacity: 0 });
    }

    // 1. Fade/blur out the old details immediately (starts at 0, lasts 0.18s)
    if (nameText.length > 0) {
      tl.to(nameText, {
        opacity: 0,
        y: -15,
        filter: "blur(8px)",
        webkitFilter: "blur(8px)",
        duration: 0.18,
        ease: "power2.in"
      }, 0);
    }

    // 2. Perform the React state swap at 0.18s
    tl.call(() => {
      setDisplayedVehicleName(VEHICLES[target].name);
      setDisplayedVehicleDetails(VEHICLES[target]);
    }, [], 0.18);

    // 3. Slide the car images left-to-right (unilateral sliding)
    // Animate active car out to the right (sliding right, scaling up, no opacity fade, getting blurry)
    tl.to(C, {
      transform: "translateX(180%) scale(1.5) scaleX(-1)",
      opacity: 1,
      filter: "blur(12px)",
      webkitFilter: "blur(12px)",
      duration: 0.55,
      ease: "power2.inOut"
    }, 0);

    // Animate the left car into the center in one continuous motion. A single
    // tween with a back ease gives a punchy, springy entrance (a subtle overshoot
    // past the resting size, then settle) without the old two-tween "pop big to a
    // hard stop, hang, then drop" that read as a double scale-down.
    tl.to(L, {
      transform: `translateX(0%) scale(${CAR_REST_SCALE}) scaleX(-1)`,
      opacity: 1,
      filter: "blur(0px)",
      webkitFilter: "blur(0px)",
      duration: 0.55,
      ease: "back.out(1.4)"
    }, 0);

    // Animate far-left car into the left background position (scaling up, losing some blur, opacity stays at 0.9)
    tl.to(FL, {
      transform: "translateX(-70%) scale(0.24) scaleX(-1)",
      opacity: 0.9,
      filter: "blur(12px)",
      webkitFilter: "blur(12px)",
      duration: 0.55,
      ease: "power2.inOut"
    }, 0);

    // Animate incoming car into the far-left position (scaling up, fading in, losing some blur)
    tl.to(IN, {
      transform: "translateX(-92%) scale(0.08) scaleX(-1)",
      opacity: 0.75,
      filter: "blur(28px)",
      webkitFilter: "blur(28px)",
      duration: 0.55,
      ease: "power2.inOut"
    }, 0);

    // 4. Fade/blur in the new details starting at 0.22s, so it completes right as the car enters the center
    if (nameText.length > 0) {
      tl.fromTo(nameText,
        {
          opacity: 0,
          y: 15,
          filter: "blur(8px)",
          webkitFilter: "blur(8px)"
        },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          webkitFilter: "blur(0px)",
          duration: 0.33,
          stagger: 0.05,
          ease: "power2.out"
        },
        0.22
      );
    }
  };

  // Handle stored theme setting

  // Handle stored theme setting
  useEffect(() => {
    const stored = localStorage.getItem("apex-form-theme");
    if (stored === "light" || stored === "dark") setMode(stored);
    else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) setMode("dark");
  }, []);

  // Smooth custom vehicle search overlay animations (backdrop blur & center card morphing)
  useEffect(() => {
    const overlay = customOverlayRef.current;
    const card = customCardRef.current;
    if (!overlay || !card) return;

    const proxy = customBlurProxyRef.current;
    const isDark = mode === "dark";
    const scrim = (v: number) =>
      isDark ? `rgba(2,2,2,${v * 0.55})` : `rgba(226,232,240,${v * 0.5})`;
    const applyBlur = (v: number) => {
      const b = v * 12;
      overlay.style.setProperty("backdrop-filter", `blur(${b}px)`);
      overlay.style.setProperty("-webkit-backdrop-filter", `blur(${b}px)`);
      overlay.style.backgroundColor = v <= 0 ? "transparent" : scrim(v);
    };
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    gsap.killTweensOf(proxy);
    gsap.killTweensOf(card);

    if (customCarOpen) {
      overlay.style.display = "flex";
      overlay.style.pointerEvents = "auto";

      if (reduce) {
        proxy.v = 1;
        applyBlur(1);
        gsap.set(card, { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", webkitFilter: "blur(0px)" });
        return;
      }

      gsap.to(proxy, {
        v: 1,
        duration: 0.5,
        ease: "power2.out",
        onUpdate: () => applyBlur(proxy.v),
      });
      gsap.fromTo(
        card,
        { opacity: 0, scale: 0.85, y: 30, filter: "blur(12px)", webkitFilter: "blur(12px)" },
        { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", webkitFilter: "blur(0px)", duration: 0.5, ease: "power3.out", delay: 0.05 }
      );
    } else {
      if (reduce) {
        proxy.v = 0;
        overlay.style.pointerEvents = "none";
        overlay.style.display = "none";
        applyBlur(0);
        gsap.set(card, { opacity: 0, scale: 0.85, y: 30, filter: "blur(12px)", webkitFilter: "blur(12px)" });
        return;
      }

      gsap.to(proxy, {
        v: 0,
        duration: 0.35,
        ease: "power2.in",
        onUpdate: () => applyBlur(proxy.v),
      });
      gsap.to(card, {
        opacity: 0,
        scale: 0.85,
        y: 30,
        filter: "blur(12px)",
        webkitFilter: "blur(12px)",
        duration: 0.35,
        ease: "power3.in",
        onComplete: () => {
          overlay.style.pointerEvents = "none";
          overlay.style.display = "none";
        },
      });
    }
  }, [customCarOpen, mode]);

  // Close the custom vehicle overlay on Escape; lock body scroll while it's open
  useEffect(() => {
    if (!customCarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCustomCarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [customCarOpen]);

  const toggleTheme = (theme: Mode) => {
    setMode(theme);
    try {
      localStorage.setItem("apex-form-theme", theme);
    } catch { }
  };

  // Stepper state validation
  const isStepValid = () => {
    if (currentStep === 0) {
      return (
        contactName.trim() !== "" &&
        contactPhone.trim() !== "" &&
        validateNigerianPhone(contactPhone) &&
        contactEmail.trim() !== "" &&
        validateEmail(contactEmail)
      );
    }
    if (currentStep === 4) {
      // Duration is optional on this screen — the user may instead pick a trip type
      // on the next screen. But if "Multiple Days" is chosen, require a valid count.
      if (selectedService?.id === "multiday") return multiDayNum >= 1;
      return true;
    }
    if (currentStep === 5) {
      // By the end of the two service screens, exactly one tier must be chosen.
      if (!selectedService) return false;
      if (selectedService.id === "multiday") return multiDayNum >= 1;
      if (selectedService.id === "custom") return customTripText.trim() !== "";
      return true;
    }
    if (currentStep === 6) {
      return bookingDate !== "" && bookingTime !== "";
    }
    if (currentStep === 7) {
      // The review step: only let the request send when every required section is done.
      return allRequiredComplete;
    }
    return true;
  };

  // Build the booking from the form, save it (unique reference via /api/bookings),
  // then move to the confirmation step where the ride-pass card is shown. Falls back
  // to a local reference if the API is unreachable, so the guest always gets a card.
  const submitBooking = async () => {
    const v = selectedVehicle;
    const isType = selectedService?.group === "type";
    const dropoff = isType ? destination.trim() || null : null;
    const duration =
      !isType && selectedService
        ? selectedService.id === "multiday"
          ? `${multiDayNum} day${multiDayNum > 1 ? "s" : ""}`
          : `${selectedService.durationHours} hours`
        : null;
    const payload = {
      passenger: { name: contactName.trim(), phone: contactPhone.trim(), email: contactEmail.trim() },
      car: { name: v.name, klass: v.class, image: v.img.light.side },
      service: selectedService?.name ?? "Chauffeur service",
      pickup: selectedLocation.name,
      dropoff,
      duration,
      date: formatCardDate(bookingDate),
      time: bookingTime,
      light: isLight,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.booking) {
        const b = data.booking as Booking;
        setConfirmedBooking(b);
        setBookingId(b.id);
      } else {
        throw new Error("save failed");
      }
    } catch {
      // Offline / API down: still show the pass with a local reference (it just
      // won't be retrievable at /check-booking until saved server-side).
      const fallbackId = "APX-" + Math.floor(100000 + Math.random() * 900000);
      setConfirmedBooking({ ...payload, id: fallbackId, createdAt: Date.now() });
      setBookingId(fallbackId);
    } finally {
      setSubmitting(false);
      setCurrentStep(8);
    }
  };

  const nextStep = () => {
    if (!isStepValid()) return;
    if (currentStep < 7) {
      setCurrentStep((s) => s + 1);
    } else if (!submitting) {
      void submitBooking();
    }
  };

  // Render the card to a PNG, then share it (phones → Photos) or download it (laptop).
  const saveCard = async () => {
    const node = passCardRef.current?.querySelector("[data-ride-card]") as HTMLElement | null;
    if (!node || saving) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const fileName = `apexride-pass-${bookingId.replace(/[^a-z0-9]/gi, "")}.png`;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], fileName, { type: "image/png" });
        const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "ApexRide pass", text: `Booking ${bookingId}` });
          return;
        }
      } catch {
        /* sharing unavailable — fall through to a normal download */
      }
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName;
      a.click();
    } catch (err) {
      console.error("card export failed", err);
    } finally {
      setSaving(false);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  };

  const resetForm = () => {
    setCurrentStep(0);
    setActiveIndex(0);
    setCarIndex(0);
    setDisplayedVehicleName(VEHICLES[0].name);
    setDisplayedVehicleDetails(VEHICLES[0]);
    setContactName("");
    setContactPhone("");
    setContactEmail("");
    setPhoneBlurred(false);
    setEmailBlurred(false);
    setDestination("");
    setSelectedVehicle(VEHICLES[0]);
    setSelectedService(null);
    setMultiDayCount("");
    setCustomTripText("");
    setBookingDate("");
    setBookingTime("");
    setSpecialRequests("");
    setBookingId("");
    setConfirmedBooking(null);
    setIsCustomCar(false);
    setCustomCarName("");
    setCustomCarYear("");
  };

  // Fetch popular models from the CarQuery API with a local fallback of all cars
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("https://www.carqueryapi.com/api/0.3/?cmd=getModels");
        if (!res.ok) throw new Error("API response error");
        const data = await res.json();
        if (data && data.Models) {
          const names = data.Models.map((m: any) => `${m.model_make_id ? m.model_make_id.charAt(0).toUpperCase() + m.model_make_id.slice(1) : ""} ${m.model_name}`.trim());
          setApiModels(Array.from(new Set(names)));
        } else {
          throw new Error("Invalid structure");
        }
      } catch (err) {
        // CURATED COMPREHENSIVE LUXURY & POPULAR VEHICLE DATABASE
        setApiModels([
          "Rolls-Royce Phantom",
          "Rolls-Royce Ghost",
          "Rolls-Royce Cullinan",
          "Rolls-Royce Wraith",
          "Bentley Continental GT",
          "Bentley Flying Spur",
          "Bentley Bentayga",
          "Mercedes-Benz S-Class",
          "Mercedes-Benz E-Class",
          "Mercedes-Benz C-Class",
          "Mercedes-Benz G-Wagon",
          "Mercedes-Benz GLE",
          "Mercedes-Benz GLC",
          "Mercedes-Benz GLS",
          "Mercedes-Benz CLA",
          "Mercedes-Benz EQE",
          "Mercedes-Benz EQS",
          "Mercedes-Benz V-Class",
          "Mercedes-Benz Sprinter",
          "BMW 7 Series",
          "BMW 5 Series",
          "BMW X7",
          "BMW X5",
          "BMW i7",
          "Audi A8",
          "Audi A6",
          "Audi Q8",
          "Audi e-tron",
          "Porsche Panamera",
          "Porsche Cayenne",
          "Porsche Taycan",
          "Porsche Macan",
          "Lexus LS 500",
          "Lexus LX 600",
          "Lexus RX 350",
          "Lexus ES 350",
          "Range Rover Autobiography",
          "Range Rover Sport",
          "Range Rover Vogue",
          "Land Rover Defender",
          "Cadillac Escalade",
          "Cadillac CT6",
          "Chevrolet Suburban",
          "Chevrolet Tahoe",
          "Toyota Land Cruiser",
          "Toyota Prado",
          "Toyota Alphard",
          "Toyota Hiace",
          "Toyota Camry",
          "Toyota Corolla",
          "Tesla Model S",
          "Tesla Model X",
          "Tesla Model Y"
        ]);
      }
    };
    fetchModels();
  }, []);

  const selectCustomCar = (carName: string) => {
    setIsCustomCar(true);
    const nameWithYear = customCarYear ? `${carName} (${customCarYear})` : carName;
    setCustomCarName(nameWithYear);
    setDisplayedVehicleName(nameWithYear);
    const customObj = {
      name: nameWithYear,
      year: customCarYear || "2025",
      class: "Bespoke Request",
      rate: "Quote on Request",
      capacity: "Capacity confirmed after review",
      specs: "Bespoke Spec",
      details: `Bespoke Vehicle Request: ${carName}. Desired Year: ${customCarYear || "Not Specified"}. Submitted via Other Options.`,
      img: {
        light: { front: "", side: "", rear: "" },
        dark: { front: "", side: "", rear: "" }
      }
    };
    setSelectedVehicle(customObj);
    setDisplayedVehicleDetails(customObj);
    setCustomCarInput("");
    setCustomCarYear("");
    setCustomCarOpen(false);
    nextStep();
  };

  // Take an OpenStreetMap search hit and pin it (updates the input + map preview).
  const pickLocationResult = (r: { display_name: string; lat: string; lon: string }) => {
    const name = r.display_name.split(",").slice(0, 2).join(", ").trim();
    skipLocationSearchRef.current = true; // input update below shouldn't re-search
    setCustomLocationInput(r.display_name);
    setLocationPicked({ name, full: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) });
    setLocationResults([]);
  };

  // Drop the device's current position as the pickup (reverse-geocoded to an address).
  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("Location isn't available on this device.");
      return;
    }
    setLocationError("");
    setLocationLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`/api/geocode?lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          if (Array.isArray(data) && data[0]) {
            pickLocationResult(data[0]);
          } else {
            // No address match — pin the raw coordinates anyway.
            const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
            skipLocationSearchRef.current = true;
            setCustomLocationInput(coords);
            setLocationPicked({ name: "Current location", full: coords, lat: latitude, lng: longitude });
            setLocationResults([]);
          }
        } catch {
          setLocationError("Couldn't look up that location.");
        } finally {
          setLocationLocating(false);
        }
      },
      () => {
        setLocationLocating(false);
        setLocationError("Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Commit the pinned OpenStreetMap location as the selected pickup (Step 2 popup)
  const selectCustomLocation = () => {
    if (!locationPicked) return;
    const landmark = customLocationLandmark.trim();
    setIsCustomLocation(true);
    setSelectedLocation({
      id: "custom",
      name: landmark ? `${locationPicked.name} — ${landmark}` : locationPicked.name,
      subtitle: locationPicked.full,
      code: "PIN",
      desc: "",
      coordinates: `${locationPicked.lat.toFixed(5)}, ${locationPicked.lng.toFixed(5)}`,
    });
    setCustomLocationOpen(false);
  };

  // Move the location carousel; leaving any custom pickup so presets take over again
  const moveLocation = (updater: (i: number) => number) => {
    setIsCustomLocation(false);
    setActiveIndex(updater);
  };

  const getSuggestions = () => {
    if (!customCarInput.trim()) return [];
    const query = customCarInput.toLowerCase();
    const matches = apiModels.filter((m) => m.toLowerCase().includes(query));
    return matches.slice(0, 3);
  };



  // Carousel relative offset helper
  const getDiff = (idx: number) => {
    let d = idx - activeIndex;
    const count = LOCATIONS.length;
    if (d < -1) d += count;
    if (d > 1) d -= count;
    return d;
  };

  const heading = isLight ? "text-neutral-900" : "text-white";
  const sub = isLight ? "text-neutral-600" : "text-white/60";

  // On the Car Type step the heading shows a vehicle name; resolve the matching
  // vehicle (kept in sync with the animated label) so we can show its year/price.
  const headingVehicle =
    currentStep === 3 ? VEHICLES.find((v) => v.name === displayedSubLabel) : undefined;

  return (
    <main
      className={`relative h-dvh w-full overflow-hidden transition-colors duration-500 flex flex-col justify-between ${mode}`}
      style={{ background: BG_GRADIENT[mode], colorScheme: mode }}
    >
      {/* 1. Header component */}
      <header className="flex items-center justify-between px-5 sm:px-8 md:px-12 py-5 z-20">
        <div className="flex items-center">
          {/* Back button container with sliding width and fade */}
          <div
            ref={backButtonContainerRef}
            className="overflow-hidden flex items-center"
            style={{ width: 0, opacity: 0, transform: "translateX(-15px)" }}
          >
            <button
              onClick={prevStep}
              className={`pointer-events-auto flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-colors duration-300 pr-1 ${
                isLight ? "text-neutral-900/60 hover:text-neutral-900" : "text-white/60 hover:text-white"
              }`}
            >
              <ArrowLeftIcon />
              <span>Back</span>
            </button>
          </div>

          {/* Vertical Divider with Clip Path inset (reveals top to bottom) */}
          <div
            ref={headerDividerRef}
            className={`h-4 w-[1px] mx-4 origin-top ${isLight ? "bg-neutral-900/15" : "bg-white/15"}`}
            style={{ opacity: 0, clipPath: "inset(0% 0% 100% 0%)" }}
          />

          {/* Logo and text wrapper */}
          <div className={`flex items-center gap-2.5 ${heading}`}>
            <div ref={logoContainerRef} className="inline-flex">
              <Logo size={28} color={isLight ? "#0c1222" : "#f3f5fa"} accent={accent} />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-[0.08em]">
              Apex<span className="font-semibold" style={{ color: accent }}>Ride</span>
            </h4>
          </div>
        </div>

        <ContactButton onClick={() => setContactOpen(true)} />
      </header>

      {/* Floating step progress text, positioned constantly at the top */}
      {currentStep <= 7 && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-20 w-full px-5 text-center flex flex-col items-center gap-1 sm:gap-2 select-none pointer-events-none">
          <div className="h-5 flex items-center justify-center overflow-visible">
            <p className={`step-text text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] ${sub}`}>
              {displayedStepText}
            </p>
          </div>
          {currentStep !== 3 && (
            <div className="flex flex-col items-center">
              <h1 className={`max-w-4xl text-3xl font-bold tracking-tight sm:text-5xl ${heading} transition-all duration-300 min-h-[44px] sm:min-h-[50px] flex items-center justify-center text-center`}>
                <span className="sub-step-text inline-block">
                  {displayedSubLabel}
                </span>
              </h1>
              {headingVehicle && (
                <div className={`heading-vehicle-info -mt-1 text-sm sm:text-base font-mono tracking-wide ${sub}`}>
                  {headingVehicle.year} · {headingVehicle.rate}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Main content container — bounded to the viewport so the page never scrolls.
          The Schedule step (6) carries a calendar + time picker that can exceed the
          viewport, so there it top-aligns and scrolls within the band between the
          fixed heading and footer instead of centering. */}
      <div className={`flex-1 min-h-0 flex flex-col items-center px-4 pt-8 pb-44 z-10 ${currentStep === 6 || currentStep === 8 ? "justify-start overflow-y-auto" : "justify-center"}`}>

        {currentStep <= 7 && (
          <div className={`w-full flex flex-col items-center text-center transition-all duration-300 ${currentStep === 3 ? "max-w-7xl" : "max-w-5xl"
            }`}>
            {/* Spacer to preserve form placement where h1 used to be */}
            <div className="h-[50px] mt-2.5" />

            {/* Step 1: Contact Details */}
            {currentStep === 0 && (
              <form
                onSubmit={(e) => e.preventDefault()}
                className={`w-full max-w-md mt-8 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border ${cardBgStyle} text-left flex flex-col gap-6`}
              >

                <div className="flex flex-col">
                  <label htmlFor="contactName" className={`text-xs font-semibold tracking-wide mb-2 font-josefin ${isLight ? "text-neutral-600" : "text-white/50"}`}>Full Name *</label>
                  <input
                    type="text"
                    id="contactName"
                    name="name"
                    autoComplete="name"
                    placeholder="John Doe"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={`w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin focus:outline-none transition-colors duration-300 ${isLight
                      ? "border-neutral-900/25 text-neutral-900 placeholder-neutral-900/35 focus:border-[#00209C]"
                      : "border-white/15 text-white placeholder-white/25 focus:border-[#FDBA16]"
                      }`}
                  />
                </div>

                <div className="flex flex-col">
                  <label htmlFor="contactPhone" className={`text-xs font-semibold tracking-wide mb-2 font-josefin ${isLight ? "text-neutral-600" : "text-white/50"}`}>Phone Number *</label>
                  <input
                    type="tel"
                    id="contactPhone"
                    name="phone"
                    autoComplete="tel"
                    placeholder="08012345678"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    onBlur={() => setPhoneBlurred(true)}
                    className={`w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin focus:outline-none transition-colors duration-300 ${isLight
                      ? "border-neutral-900/25 text-neutral-900 placeholder-neutral-900/35 focus:border-[#00209C]"
                      : "border-white/15 text-white placeholder-white/25 focus:border-[#FDBA16]"
                      }`}
                  />
                  {showPhoneError && (
                    <span className={`text-[10px] font-medium mt-2 ${isLight ? "text-red-600" : "text-red-400"}`}>
                      Invalid Nigerian phone number. Must be 11 digits starting with 0 (e.g. 08012345678).
                    </span>
                  )}
                </div>

                <div className="flex flex-col">
                  <label htmlFor="contactEmail" className={`text-xs font-semibold tracking-wide mb-2 font-josefin ${isLight ? "text-neutral-600" : "text-white/50"}`}>Email Address *</label>
                  <input
                    type="email"
                    id="contactEmail"
                    name="email"
                    autoComplete="email"
                    placeholder="john@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    onBlur={() => setEmailBlurred(true)}
                    className={`w-full pb-2 bg-transparent border-b rounded-none text-sm font-josefin focus:outline-none transition-colors duration-300 ${isLight
                      ? "border-neutral-900/25 text-neutral-900 placeholder-neutral-900/35 focus:border-[#00209C]"
                      : "border-white/15 text-white placeholder-white/25 focus:border-[#FDBA16]"
                      }`}
                  />
                  {showEmailError && (
                    <span className={`text-[10px] font-medium mt-2 ${isLight ? "text-red-600" : "text-red-400"}`}>
                      Invalid email address. Please enter a valid address (e.g. john@example.com).
                    </span>
                  )}
                </div>

              </form>
            )}

            {/* Step 2: Pickup Location Carousel (Black Squares) */}
            {currentStep === 1 && (
              <div
                className="relative w-full h-[340px] sm:h-[420px] flex items-center justify-center mt-2"
                {...makeSwipeHandlers((dir) =>
                  moveLocation((idx) => (idx + dir + LOCATIONS.length) % LOCATIONS.length)
                )}
              >

                {/* Left arrow */}
                <button
                  onClick={() => moveLocation((idx) => (idx - 1 + LOCATIONS.length) % LOCATIONS.length)}
                  className={`pointer-events-auto absolute left-1 sm:left-4 lg:left-12 z-20 w-11 h-11 flex items-center justify-center rounded-full border transition-all duration-300 ${isLight ? "border-neutral-900/40 bg-white/70 text-neutral-900 hover:bg-neutral-900/[0.08]" : "border-white/30 bg-white/5 text-white hover:bg-white/[0.12]"
                    }`}
                  aria-label="Previous Location"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>

                {/* The 3D-Style Carousel */}
                <div className="relative w-full max-w-4xl h-full flex items-center justify-center overflow-visible">
                  {LOCATIONS.map((loc, idx) => {
                    const diff = getDiff(idx);
                    const isActive = diff === 0;
                    const isPrev = diff === -1;
                    const isNext = diff === 1;
                    const cityImg = LOCATION_CITY_IMG[loc.id];

                    let transformClass = "";
                    if (isActive) {
                      transformClass = "translate-x-0 translate-y-0 scale-[1.15] z-10 opacity-100 rotate-0";
                    } else if (isPrev) {
                      transformClass = "-translate-x-[9rem] sm:-translate-x-[15rem] lg:-translate-x-[19rem] translate-y-8 scale-[0.5] z-0 opacity-40 rotate-0 pointer-events-auto cursor-pointer";
                    } else if (isNext) {
                      transformClass = "translate-x-[9rem] sm:translate-x-[15rem] lg:translate-x-[19rem] translate-y-8 scale-[0.5] z-0 opacity-40 rotate-0 pointer-events-auto cursor-pointer";
                    } else {
                      transformClass = "translate-y-24 scale-50 z-0 opacity-0 pointer-events-none";
                    }

                    return (
                      <div
                        key={loc.id}
                        onClick={() => {
                          if (isPrev) moveLocation((i) => (i - 1 + LOCATIONS.length) % LOCATIONS.length);
                          if (isNext) moveLocation((i) => (i + 1) % LOCATIONS.length);
                        }}
                        className={`absolute w-52 h-52 sm:w-64 sm:h-64 transition-all duration-700 cubic-bezier(0.25, 1, 0.5, 1) transform flex flex-col items-center justify-center ${transformClass}`}
                      >
                        {/* the floating-island render, centered (no code badge / card) */}
                        <div className="relative min-h-0 w-full flex-1">
                          <Image
                            src={isLight ? cityImg.light : cityImg.dark}
                            alt={loc.name}
                            fill
                            sizes="(max-width: 640px) 80vw, 360px"
                            draggable={false}
                            className="select-none object-contain"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right arrow */}
                <button
                  onClick={() => moveLocation((idx) => (idx + 1) % LOCATIONS.length)}
                  className={`pointer-events-auto absolute right-1 sm:right-4 lg:right-12 z-20 w-11 h-11 flex items-center justify-center rounded-full border transition-all duration-300 ${isLight ? "border-neutral-900/40 bg-white/70 text-neutral-900 hover:bg-neutral-900/[0.08]" : "border-white/30 bg-white/5 text-white hover:bg-white/[0.12]"
                    }`}
                  aria-label="Next Location"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            )}

            {/* Step 3: Destination */}
            {currentStep === 2 && (
              <div className={`w-full max-w-md mt-8 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border ${cardBgStyle} text-left flex flex-col gap-6`}>
                <div className="flex flex-col">
                  <label className={labelStyle}>Destination (Optional)</label>
                  <input
                    type="text"
                    placeholder="Where are you headed?"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className={inputStyle}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Car Type — the selected car shown from three angles (front · side · rear) */}
            {currentStep === 3 && (
              <div className="w-full flex flex-col items-center">
                <div
                  className="relative w-full h-[28vh] max-h-[290px] flex items-center justify-center mt-2"
                  {...makeSwipeHandlers((dir) => spinCar(dir))}
                >

                  {/* Left arrow */}
                  <button
                    onClick={() => spinCar(-1)}
                    className={`pointer-events-auto absolute left-2 lg:left-8 z-40 w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-300 shadow-md ${isLight
                      ? "bg-white text-[#00209C] border border-neutral-200 hover:bg-neutral-50"
                      : "bg-neutral-900 text-[#FDBA16] border border-white/10 hover:bg-neutral-800"
                      }`}
                    aria-label="Previous Vehicle"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>

                  {/* Unilateral Sliding Carousel */}
                  <div className="relative w-full max-w-5xl h-full flex items-center justify-center overflow-visible pointer-events-none">
                    {/* Front — incoming flanker showing off-screen waiting vehicle */}
                    <div
                      ref={incomingCarRef}
                      className="absolute w-[84%] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl flex items-center justify-center z-0"
                      style={{
                        transform: "translateX(-102%) scale(0.02) scaleX(-1)",
                        opacity: 0,
                        filter: "blur(28px)",
                        willChange: "transform, opacity, filter",
                        pointerEvents: "none"
                      }}
                    >
                      <Image
                        src={encodeURI(`/images/${incomingVehicle.img[isLight ? "light" : "dark"].front}`)}
                        alt={`${incomingVehicle.name} incoming front view`}
                        width={800}
                        height={450}
                        draggable={false}
                        className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-2xl"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    </div>

                    {/* Front — far-left flanker showing deep background vehicle */}
                    <div
                      ref={farLeftCarRef}
                      className="absolute w-[84%] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl flex items-center justify-center z-10"
                      style={{
                        transform: "translateX(-92%) scale(0.08) scaleX(-1)",
                        opacity: 0.75,
                        filter: "blur(28px)",
                        willChange: "transform, opacity, filter",
                        pointerEvents: "none"
                      }}
                    >
                      <Image
                        src={encodeURI(`/images/${farLeftVehicle.img[isLight ? "light" : "dark"].front}`)}
                        alt={`${farLeftVehicle.name} far front view`}
                        width={800}
                        height={450}
                        draggable={false}
                        className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-2xl"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    </div>

                    {/* Front — left flanker showing next vehicle */}
                    <div
                      ref={leftCarRef}
                      className="absolute w-[84%] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl flex items-center justify-center z-20"
                      style={{
                        transform: "translateX(-70%) scale(0.24) scaleX(-1)",
                        opacity: 0.9,
                        filter: "blur(12px)",
                        willChange: "transform, opacity, filter",
                        pointerEvents: "none"
                      }}
                    >
                      <Image
                        src={encodeURI(`/images/${leftVehicle.img[isLight ? "light" : "dark"].front}`)}
                        alt={`${leftVehicle.name} front view`}
                        width={800}
                        height={450}
                        draggable={false}
                        className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-2xl"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    </div>

                    {/* Front — right flanker showing previous vehicle (used in custom car mode) */}
                    <div
                      ref={rightCarRef}
                      className="absolute w-[84%] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl flex items-center justify-center z-20"
                      style={{
                        transform: "translateX(85%) scale(0.35) scaleX(-1)",
                        opacity: 0,
                        willChange: "transform, opacity",
                        pointerEvents: "none"
                      }}
                    >
                      <Image
                        src={encodeURI(`/images/${prevVehicleObj.img[isLight ? "light" : "dark"].front}`)}
                        alt={`${prevVehicleObj.name} right view`}
                        width={800}
                        height={450}
                        draggable={false}
                        className="w-full h-auto object-contain select-none pointer-events-none drop-shadow-2xl"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    </div>

                    {/* Front — active, centered hero */}
                    <div
                      ref={centerCarRef}
                      className="absolute w-[84%] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl flex items-center justify-center z-30"
                      style={{
                        transform: `translateX(0%) scale(${CAR_REST_SCALE}) scaleX(-1)`,
                        opacity: isCustomCar ? 0 : 1,
                        willChange: "transform, opacity, filter",
                        pointerEvents: "none"
                      }}
                    >
                      {!isCustomCar && selectedVehicleObj.img[isLight ? "light" : "dark"].front && (
                        <Image
                          src={encodeURI(`/images/${selectedVehicleObj.img[isLight ? "light" : "dark"].front}`)}
                          alt={`${selectedVehicleObj.name} front view`}
                          width={800}
                          height={450}
                          priority
                          draggable={false}
                          className="w-full h-auto max-h-[24vh] object-contain select-none pointer-events-none drop-shadow-2xl"
                          sizes="(max-width: 768px) 100vw, 800px"
                        />
                      )}
                    </div>
                  </div>

                  {/* Right arrow */}
                  <button
                    onClick={() => spinCar(1)}
                    className={`pointer-events-auto absolute right-2 lg:right-8 z-40 w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-300 shadow-md ${isLight
                      ? "bg-white text-[#00209C] border border-neutral-200 hover:bg-neutral-50"
                      : "bg-neutral-900 text-[#FDBA16] border border-white/10 hover:bg-neutral-800"
                      }`}
                    aria-label="Next Vehicle"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>

                {/* Details layout under the carousel */}
                <div className="mt-3 sm:mt-4 flex flex-col items-center text-center px-4 max-w-xl transition-all duration-300 pointer-events-auto">
                  <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight ${isLight ? "text-neutral-900" : "text-white"} min-h-[40px] flex items-center justify-center text-center`}>
                    <span className="car-name-text inline-block">
                      {displayedVehicleName}
                    </span>
                  </h2>
                  <div className={`text-xs sm:text-sm font-medium tracking-wide mt-1.5 ${isLight ? "text-neutral-600" : "text-white/60"} text-center`}>
                    <span className="car-detail-text inline-block">{displayedVehicleDetails.year}</span>
                    <span className={`car-detail-text inline-block mx-2 font-bold text-base ${isLight ? "text-[#00209C]" : "text-[#FDBA16]"}`}>·</span>
                    <span className="car-detail-text inline-block">{displayedVehicleDetails.rate}</span>
                    <span className={`car-detail-text inline-block mx-2 font-bold text-base ${isLight ? "text-[#00209C]" : "text-[#FDBA16]"}`}>·</span>
                    <span className="car-detail-text inline-block">{displayedVehicleDetails.specs}</span>
                  </div>
                  <div className={`car-detail-text mt-2 rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide ${isLight ? "bg-[#00209C]/10 text-[#00209C]" : "bg-[#FDBA16]/10 text-[#FDBA16]"}`}>
                    {displayedVehicleDetails.capacity}
                  </div>
                </div>
              </div>
            )}

            {/* Step 5: Duration (6h / 12h / 24h / Multiple Days) */}
            {currentStep === 4 && (
              <div className="w-full max-w-3xl mt-8 flex flex-col items-center gap-6">
                <div className="grid w-full grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {DURATION_SERVICES.map(renderTierCard)}
                </div>

                {/* Multiple Days → ask how many days. Plain text box per spec. */}
                {selectedService?.id === "multiday" && (
                  <div className={`w-full max-w-xs p-5 rounded-2xl border ${cardBgStyle} text-left`}>
                    <label className={labelStyle}>Number of Days *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={multiDayCount}
                      onChange={(e) => setMultiDayCount(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="Put a number"
                      className={`${inputStyle} font-mono`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 6: Trip / Service Type (Custom / Interstate / Airport / Point) */}
            {currentStep === 5 && (
              <div className="w-full max-w-3xl mt-8 flex flex-col items-center gap-6">
                <div className="grid w-full grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {TYPE_SERVICES.map(renderTierCard)}
                </div>

                {/* Custom → free-text description of the trip. */}
                {selectedService?.id === "custom" && (
                  <div className={`w-full max-w-md p-5 rounded-2xl border ${cardBgStyle} text-left`}>
                    <label className={labelStyle}>Tell us about your custom trip *</label>
                    <textarea
                      maxLength={300}
                      value={customTripText}
                      onChange={(e) => setCustomTripText(e.target.value)}
                      placeholder="Describe your route, stops, dates or anything special…"
                      className={`${textareaStyle} h-24`}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 7: Schedule (Date & Time) */}
            {currentStep === 6 && (
              <div className={`w-full max-w-lg shrink-0 mt-2 p-4 sm:p-5 rounded-3xl border ${cardBgStyle} text-left flex flex-col gap-3`}>
                {/* How would you like to set the pickup? Two clear paths. */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { key: "quick" as const, title: "Quick Pickup", sub: "Ready made times", Icon: ClockIcon },
                    { key: "custom" as const, title: "Choose Date & Time", sub: "Pick on a calendar", Icon: CalendarIcon },
                  ].map((opt) => {
                    const active = scheduleMode === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => (opt.key === "custom" ? enterCustomSchedule() : setScheduleMode("quick"))}
                        className={`flex items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-all duration-300 ${
                          active
                            ? isLight
                              ? "border-[#00209C] bg-[#00209C] text-white shadow-lg shadow-[#00209C]/20"
                              : "border-[#FDBA16] bg-[#FDBA16] text-neutral-950 shadow-lg shadow-[#FDBA16]/15"
                            : isLight
                              ? "border-neutral-900/10 bg-white/40 text-neutral-900 hover:border-[#00209C]/40 hover:bg-white/70"
                              : "border-white/10 bg-white/[0.04] text-white hover:border-[#FDBA16]/40 hover:bg-white/[0.08]"
                        }`}
                      >
                        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                          active
                            ? isLight ? "bg-white/20 text-white" : "bg-neutral-950/15 text-neutral-950"
                            : isLight ? "bg-[#00209C]/10 text-[#00209C]" : "bg-[#FDBA16]/12 text-[#FDBA16]"
                        }`}>
                          <opt.Icon />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium tracking-tight">{opt.title}</span>
                          <span className={`block text-[11px] leading-snug ${active ? "opacity-75" : isLight ? "text-neutral-900/45" : "text-white/40"}`}>{opt.sub}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Quick pickup presets */}
                {scheduleMode === "quick" && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {pickupOptions.map((option) => {
                      const optionDate = formatDateInput(option.date);
                      const optionTime = formatTimeInput(option.date);
                      const active = bookingDate === optionDate && bookingTime === optionTime;
                      return (
                        <button
                          key={`${option.label}-${optionDate}-${optionTime}`}
                          type="button"
                          onClick={() => applyPickupDate(option.date)}
                          className={`rounded-2xl border px-3.5 py-3 text-left transition-all duration-300 ${
                            active
                              ? isLight
                                ? "border-[#00209C] bg-[#00209C] text-white shadow-lg shadow-[#00209C]/20"
                                : "border-[#FDBA16] bg-[#FDBA16] text-neutral-950 shadow-lg shadow-[#FDBA16]/15"
                              : isLight
                                ? "border-neutral-900/10 bg-white/40 text-neutral-900 hover:border-[#00209C]/40 hover:bg-white/70"
                                : "border-white/10 bg-white/[0.04] text-white hover:border-[#FDBA16]/40 hover:bg-white/[0.08]"
                          }`}
                        >
                          <span className="block text-[13px] font-medium tracking-tight">{option.label}</span>
                          <span className={`mt-0.5 block text-[10.5px] leading-snug ${active ? "opacity-70" : isLight ? "text-neutral-900/45" : "text-white/40"}`}>
                            {option.helper}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Custom path — a tappable calendar plus an easy time spinner */}
                {scheduleMode === "custom" && (
                  <div className="grid gap-3 sm:grid-cols-2 sm:items-start">
                    {/* Calendar */}
                    <div>
                      <label className={labelStyle}>Select Date</label>
                      <div className={`rounded-2xl border p-3 ${isLight ? "border-neutral-900/10 bg-white/40" : "border-white/10 bg-white/[0.03]"}`}>
                        <div className="mb-3 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => shiftMonth(-1)}
                            disabled={!canGoPrevMonth}
                            aria-label="Previous month"
                            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${canGoPrevMonth ? (isLight ? "text-neutral-700 hover:bg-neutral-900/[0.06]" : "text-white/70 hover:bg-white/10") : "cursor-not-allowed opacity-25"}`}
                          >
                            <Chevron dir="left" />
                          </button>
                          <span className={`text-sm font-medium ${isLight ? "text-neutral-900" : "text-white"}`}>
                            {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                          </span>
                          <button
                            type="button"
                            onClick={() => shiftMonth(1)}
                            aria-label="Next month"
                            className={`grid h-8 w-8 place-items-center rounded-full transition-colors ${isLight ? "text-neutral-700 hover:bg-neutral-900/[0.06]" : "text-white/70 hover:bg-white/10"}`}
                          >
                            <Chevron dir="right" />
                          </button>
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {WEEKDAYS.map((w) => (
                            <div key={w} className={`pb-1 text-center text-[10px] font-semibold uppercase ${isLight ? "text-neutral-900/35" : "text-white/30"}`}>{w}</div>
                          ))}
                          {calendarCells.map((date, i) => {
                            if (!date) return <div key={`pad-${i}`} />;
                            const iso = formatDateInput(date);
                            const selected = bookingDate === iso;
                            const past = date < todayStart();
                            const isToday = iso === formatDateInput(new Date());
                            return (
                              <button
                                key={iso}
                                type="button"
                                disabled={past}
                                onClick={() => setBookingDate(iso)}
                                className={`aspect-square rounded-lg text-[13px] font-medium tabular-nums transition-all duration-200 ${
                                  selected
                                    ? isLight ? "bg-[#00209C] text-white shadow-md shadow-[#00209C]/25" : "bg-[#FDBA16] text-neutral-950 shadow-md shadow-[#FDBA16]/20"
                                    : past
                                      ? isLight ? "cursor-not-allowed text-neutral-900/20" : "cursor-not-allowed text-white/15"
                                      : isLight ? "text-neutral-800 hover:bg-[#00209C]/10" : "text-white/80 hover:bg-[#FDBA16]/15"
                                } ${isToday && !selected ? (isLight ? "ring-1 ring-inset ring-[#00209C]/40" : "ring-1 ring-inset ring-[#FDBA16]/40") : ""}`}
                              >
                                {date.getDate()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Time spinner — hour / minute wheels plus an AM·PM toggle */}
                    <div>
                      <label className={labelStyle}>Select Time</label>
                      <div className={`flex items-center justify-center gap-2 sm:gap-3 rounded-2xl border p-3 ${isLight ? "border-neutral-900/10 bg-white/40" : "border-white/10 bg-white/[0.03]"}`}>
                        {[
                          { label: "Hour", value: String(timeHour12).padStart(2, "0"), up: () => stepHour(1), down: () => stepHour(-1) },
                          { label: "Min", value: String(parsedTime.m).padStart(2, "0"), up: () => stepMinute(1), down: () => stepMinute(-1) },
                        ].map((col, idx) => (
                          <div key={col.label} className="flex items-center gap-2 sm:gap-3">
                            {idx === 1 && <span className={`text-2xl font-light ${isLight ? "text-neutral-900/30" : "text-white/25"}`}>:</span>}
                            <div className="flex flex-col items-center gap-0.5">
                              <button type="button" onClick={col.up} aria-label={`${col.label} up`} className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${isLight ? "text-[#00209C] hover:bg-[#00209C]/10" : "text-[#FDBA16] hover:bg-[#FDBA16]/15"}`}>
                                <Chevron dir="up" />
                              </button>
                              <div className={`w-12 text-center text-2xl font-light tabular-nums ${isLight ? "text-neutral-900" : "text-white"}`}>{col.value}</div>
                              <button type="button" onClick={col.down} aria-label={`${col.label} down`} className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${isLight ? "text-[#00209C] hover:bg-[#00209C]/10" : "text-[#FDBA16] hover:bg-[#FDBA16]/15"}`}>
                                <Chevron dir="down" />
                              </button>
                              <span className={`text-[10px] uppercase tracking-wider ${isLight ? "text-neutral-900/35" : "text-white/30"}`}>{col.label}</span>
                            </div>
                          </div>
                        ))}
                        <div className="ml-1 flex flex-col gap-1.5">
                          {(["AM", "PM"] as const).map((p) => {
                            const on = timePeriod === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setPeriod(p)}
                                className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all ${
                                  on
                                    ? isLight ? "bg-[#00209C] text-white" : "bg-[#FDBA16] text-neutral-950"
                                    : isLight ? "bg-neutral-900/[0.05] text-neutral-600 hover:bg-neutral-900/10" : "bg-white/[0.05] text-white/60 hover:bg-white/10"
                                }`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Confirmation timeline. Once a date & time are chosen we echo
                    them back in a readable form, and append the auto-derived
                    drop-off when the chosen service has a duration. */}
                {bookingDate && bookingTime ? (
                  <div className={`rounded-2xl border p-3.5 ${isLight ? "border-[#00209C]/20 bg-[#00209C]/[0.05]" : "border-[#FDBA16]/20 bg-[#FDBA16]/[0.06]"}`}>
                    <div className="flex items-start gap-3">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isLight ? "bg-[#00209C]/10 text-[#00209C]" : "bg-[#FDBA16]/12 text-[#FDBA16]"}`}>
                        <CalendarIcon />
                      </span>
                      <div className="min-w-0">
                        <div className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? "text-neutral-900/45" : "text-white/45"}`}>Pickup</div>
                        <div className={`mt-0.5 text-sm font-medium ${isLight ? "text-neutral-900" : "text-white"}`}>{formatHumanDate(bookingDate)}</div>
                        <div className={`text-xs ${isLight ? "text-neutral-900/60" : "text-white/55"}`}>{formatHumanTime(bookingTime)}</div>
                      </div>
                    </div>

                    {(isFixedDuration || hasMultiDay) && (
                      <>
                        <div className={`my-1.5 ml-[15px] h-3.5 border-l border-dashed ${isLight ? "border-[#00209C]/30" : "border-[#FDBA16]/30"}`} />
                        <div className="flex items-start gap-3">
                          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isLight ? "bg-[#00209C]/10 text-[#00209C]" : "bg-[#FDBA16]/12 text-[#FDBA16]"}`}>
                            <RouteIcon />
                          </span>
                          <div className="min-w-0">
                            <div className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? "text-neutral-900/45" : "text-white/45"}`}>Estimated Drop Off</div>
                            <div className={`mt-0.5 text-sm font-medium ${isLight ? "text-neutral-900" : "text-white"}`}>
                              {autoEnd ? formatHumanDate(formatDateInput(autoEnd)) : "Set a pickup first"}
                            </div>
                            {autoEnd && !hasMultiDay && (
                              <div className={`text-xs ${isLight ? "text-neutral-900/60" : "text-white/55"}`}>{formatHumanTime(formatTimeInput(autoEnd))}</div>
                            )}
                            <p className={`mt-1 text-[10.5px] leading-relaxed ${isLight ? "text-neutral-900/45" : "text-white/40"}`}>
                              {hasMultiDay
                                ? `Auto calculated from your ${multiDayNum} day booking.`
                                : `Auto calculated from your fixed ${selectedService?.name} block.`}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : scheduleMode ? (
                  <div className={`flex items-center gap-2.5 rounded-2xl border border-dashed p-4 text-xs leading-relaxed ${isLight ? "border-neutral-900/15 text-neutral-900/45" : "border-white/15 text-white/40"}`}>
                    <span className={`shrink-0 ${isLight ? "text-[#00209C]" : "text-[#FDBA16]"}`}><CalendarIcon /></span>
                    {scheduleMode === "quick"
                      ? "Tap a quick option above to set your pickup."
                      : "Pick a date and time above to set your pickup."}
                  </div>
                ) : null}
              </div>
            )}

            {/* Step 8: Special Requests (with Booking Summary Card) */}
            {currentStep === 7 && (
              <div className="w-full max-w-xl mt-8 flex flex-col gap-6 lg:max-w-5xl lg:flex-row lg:items-start">

                {/* Booking Summary Recap Card */}
                <div className={`p-5 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] border ${cardBgStyle} text-left lg:flex-1 lg:min-w-0`}>
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div
                        className="text-xs font-bold uppercase tracking-widest"
                        style={{ color: isLight ? "#00209C" : "#FDBA16" }}
                      >
                        Review Request
                      </div>
                      <p className={`mt-2 text-xs leading-relaxed ${isLight ? "text-neutral-900/55" : "text-white/50"}`}>
                        Green sections are ready. Red still needs your attention. Tap any section to edit it.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    {[
                      { label: "Contact", value: `${contactName} · ${contactPhone}`, step: 0, required: true, done: contactComplete },
                      { label: "Pickup", value: selectedLocation.name, step: 1, required: true, done: pickupComplete },
                      { label: "Destination", value: destination.trim() || "Optional", step: 2, required: false, done: destination.trim() !== "" },
                      { label: "Vehicle", value: `${selectedVehicle.name} · ${selectedVehicle.capacity}`, step: 3, required: true, done: vehicleComplete },
                      { label: "Service", value: serviceSummary, step: 4, required: true, done: serviceComplete },
                      { label: "Schedule", value: scheduleSummary, step: 6, required: true, done: scheduleComplete },
                    ].map((item) => {
                      const incomplete = item.required && !item.done;
                      const tone = incomplete ? badColor : item.done ? okColor : null;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setCurrentStep(item.step)}
                          aria-label={incomplete ? `${item.label} incomplete, tap to complete` : `Edit ${item.label}`}
                          className="w-full rounded-2xl border p-3.5 text-left transition-colors hover:brightness-[0.98] active:translate-y-px"
                          style={{
                            borderColor: tone ? `${tone}66` : isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                            backgroundColor: tone ? `${tone}14` : isLight ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <span className={`text-[10px] uppercase tracking-wider ${isLight ? "text-neutral-900/40" : "text-white/45"}`}>
                              {item.label}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                              style={{
                                color: tone ?? (isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.45)"),
                                backgroundColor: tone ? `${tone}1F` : "transparent",
                              }}
                            >
                              {incomplete ? "! Incomplete" : item.done ? "✓ Done" : "Optional"}
                            </span>
                          </div>
                          <div
                            className="font-semibold leading-snug"
                            style={{ color: incomplete ? badColor : isLight ? "#171717" : "#ffffff" }}
                          >
                            {incomplete ? "Field incomplete. Tap to complete." : item.value}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Special Requests Textarea */}
                <div className={`p-5 sm:p-6 rounded-[1.75rem] sm:rounded-[2rem] border ${cardBgStyle} text-left lg:flex-1 lg:min-w-0`}>
                  <label className={labelStyle}>Request Notes</label>
                  <p className={`-mt-1 mb-4 text-xs leading-relaxed ${isLight ? "text-neutral-900/50" : "text-white/45"}`}>
                    Tap a common request below, or write your own. Helpful details: flight number, waiting instructions, luggage count, or preferred route.
                  </p>

                  {/* Quick-add chips — toggle a ready-made line into the notes */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {QUICK_REQUESTS.map((phrase) => {
                      const active = isQuickRequestActive(phrase);
                      return (
                        <button
                          key={phrase}
                          type="button"
                          onClick={() => toggleQuickRequest(phrase)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-tight transition-all duration-200 ${
                            active
                              ? isLight
                                ? "border-[#00209C] bg-[#00209C] text-white shadow-sm shadow-[#00209C]/20"
                                : "border-[#FDBA16] bg-[#FDBA16] text-neutral-950 shadow-sm shadow-[#FDBA16]/15"
                              : isLight
                                ? "border-neutral-900/15 bg-white/40 text-neutral-700 hover:border-[#00209C]/40 hover:bg-white/70"
                                : "border-white/15 bg-white/[0.04] text-white/70 hover:border-[#FDBA16]/40 hover:bg-white/[0.08]"
                          }`}
                        >
                          <span className="text-[13px] leading-none">{active ? "✓" : "+"}</span>
                          {phrase}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`relative rounded-2xl border transition-colors duration-300 ${isLight ? "border-neutral-900/12 bg-white/40 focus-within:border-[#00209C] focus-within:bg-white/80" : "border-white/12 bg-white/[0.04] focus-within:border-[#FDBA16] focus-within:bg-neutral-900/60"}`}>
                    <textarea
                      maxLength={500}
                      placeholder="Example: Flight BA75 lands at 18:20. Please meet me at arrivals with a name sign."
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      className={`h-32 w-full resize-none bg-transparent p-4 pb-9 text-sm font-josefin leading-relaxed outline-none ${isLight ? "text-neutral-900 placeholder-neutral-900/35" : "text-white placeholder-white/25"}`}
                    />
                    <div className={`pointer-events-none absolute bottom-3 right-4 text-[10px] ${isLight ? "text-neutral-900/35" : "text-white/30"}`}>
                      {specialRequests.length} / 500
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Stepper Buttons constant position at the bottom */}
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-45 flex flex-col items-center gap-2.5 pointer-events-auto select-none">
              <div className="flex items-center gap-4">
                <CtaButton
                  isLight={isLight}
                  disabled={!isStepValid()}
                  onClick={nextStep}
                  style={{ minWidth: "120px" }}
                >
                  {currentStep === 3 ? "Select" : currentStep === 7 ? "Submit Request" : "Next"}
                </CtaButton>

                <div
                  className={`transition-all duration-500 ease-out overflow-hidden rounded-full flex items-center ${
                    currentStep === 3
                      ? "max-w-[200px] opacity-100 translate-x-0"
                      : "max-w-0 opacity-0 translate-x-4 pointer-events-none"
                  }`}
                >
                  <Link
                    href="/fleet"
                    className={`pointer-events-auto rounded-full border border-dashed h-10 px-7 text-xs font-semibold tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] whitespace-nowrap flex items-center justify-center ${
                      isLight
                        ? "border-[#00209C] text-[#00209C] hover:bg-[#00209C]/[0.05]"
                        : "border-[#FDBA16] text-[#FDBA16] hover:bg-[#FDBA16]/[0.05]"
                    }`}
                  >
                    Explore our fleet
                  </Link>
                </div>

                <div
                  className={`transition-all duration-500 ease-out overflow-hidden rounded-full flex items-center ${
                    currentStep === 1
                      ? "max-w-[240px] opacity-100 translate-x-0"
                      : "max-w-0 opacity-0 translate-x-4 pointer-events-none"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setCustomLocationOpen(true)}
                    className={`pointer-events-auto rounded-full border h-10 px-7 text-xs font-semibold tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.97] whitespace-nowrap flex items-center justify-center ${
                      isCustomLocation ? "border-solid" : "border-dashed"
                    } ${
                      isLight
                        ? "border-[#00209C] text-[#00209C] hover:bg-[#00209C]/[0.05]"
                        : "border-[#FDBA16] text-[#FDBA16] hover:bg-[#FDBA16]/[0.05]"
                    }`}
                  >
                    {isCustomLocation ? "Custom location ✓" : "Customize location"}
                  </button>
                </div>
              </div>

              {/* Hand-off note from the fleet page — shown until the user reaches Car Type */}
              {preselectedCar && currentStep < 3 && (
                <div
                  className={`pointer-events-none rounded-full border px-4 py-1.5 text-[11px] font-semibold tracking-wide ${
                    isLight
                      ? "border-[#00209C]/25 bg-white/70 text-[#00209C]"
                      : "border-[#FDBA16]/30 bg-neutral-950/40 text-[#FDBA16]"
                  }`}
                >
                  {preselectedCar} is already selected in Car Type
                </div>
              )}
            </div>

          </div>
        )}

        {/* Step 9: Confirmation — the ride-pass card, populated with the booking. */}
        {currentStep === 8 && confirmedBooking && (
          <div className="w-full flex flex-col items-center text-center pt-2">
            <div className="flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isLight ? "bg-[#00209C] text-white" : "bg-[#FDBA16] text-neutral-950"}`}>
                <span className="scale-[0.55]"><CheckIcon /></span>
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: isLight ? "#00209C" : "#FDBA16" }}>
                Booking received
              </p>
            </div>
            <p className={`mt-2 max-w-sm text-xs leading-relaxed ${isLight ? "text-neutral-600" : "text-white/55"}`}>
              Save your ride pass below. Your booking number is{" "}
              <span className="font-semibold">{confirmedBooking.id}</span>; look it up anytime at{" "}
              <Link href="/check-booking" className={`font-semibold underline ${isLight ? "text-[#00209C]" : "text-[#FDBA16]"}`}>
                check booking
              </Link>.
            </p>

            <div ref={passCardRef} className="w-full flex justify-center">
              <RidePass booking={bookingToRide(confirmedBooking)} light={isLight} />
            </div>

            <div className="-mt-1 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={saveCard}
                disabled={saving}
                className={`rounded-full px-7 py-3 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 disabled:opacity-60 ${isLight ? "bg-[#00209C] text-white hover:bg-[#001a80]" : "bg-[#FDBA16] text-neutral-950 hover:bg-[#e5a912]"}`}
              >
                {saving ? "Preparing…" : "Save card to photos"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className={`rounded-full border px-7 py-3 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 ${isLight ? "border-neutral-300 text-neutral-700 hover:bg-neutral-100" : "border-white/20 text-white/80 hover:bg-white/10"}`}
              >
                Book another
              </button>
            </div>
          </div>
        )}

      </div>

      {/* 3. Stepper progress tracker floating glass-morphic dock (8 indicators) */}
      <div className="pointer-events-auto fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[88vw] sm:max-w-[70vw] px-0 z-20 select-none">
        <div className="relative px-0 py-5 transition-all duration-300">
          <div className="relative grid grid-cols-8 items-start">
            {/* The horizontal connecting line */}
            <div
              className={`absolute top-[8px] h-[1px] -z-10 ${isLight ? "bg-neutral-900/10" : "bg-white/10"
                }`}
              style={{
                left: "calc(100% / 16)",
                right: "calc(100% / 16)",
              }}
            />

            {/* The active progress colored overlay */}
            <div
              className="absolute top-[8px] h-[1.5px] -z-10"
              style={{
                left: "calc(100% / 16)",
                right: "calc(100% / 16)",
              }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${currentStep <= 7 ? (currentStep / 7) * 100 : 100}%`,
                  background: isLight ? "#171717" : "#ffffff",
                }}
              />
            </div>

            {STEPS.map((stepName, idx) => {
              const isCompleted = currentStep > idx || currentStep === 8;
              const isActive = currentStep === idx;

              const accentHex = isLight ? "#00209C" : "#FDBA16";

              return (
                <div key={stepName} className="flex flex-col items-center">
                  <div className="h-4 flex items-center justify-center">
                    <button
                      onClick={() => currentStep <= 7 && setCurrentStep(idx)}
                      disabled={currentStep > 7}
                      className={`relative transition-all duration-300 focus:outline-none before:absolute before:content-[''] before:inset-[-11px] ${isActive
                        ? "w-3.5 h-3.5 border rounded-full shadow-md scale-110 cursor-pointer"
                        : "w-2.5 h-2.5 border-2 rounded-full cursor-pointer"
                        }`}
                      style={{
                        backgroundColor: isActive
                          ? accentHex
                          : isCompleted
                            ? (isLight ? "#a2b0d3" : "#3a2d0c")
                            : (isLight ? "#cbd5e1" : "#0a0a0a"),
                        borderColor: isActive
                          ? accentHex
                          : (isLight ? "rgba(0, 32, 156, 0.8)" : "rgba(253, 186, 22, 0.8)"),
                        boxShadow: isActive
                          ? `0 0 0 4px ${isLight ? "rgba(0, 32, 156, 0.2)" : "rgba(253, 186, 22, 0.2)"}`
                          : undefined,
                      }}
                    />
                  </div>
                  <span className={`mt-2.5 hidden sm:block text-[11px] font-semibold tracking-wide font-sans transition-colors duration-300 ${isActive
                    ? (isLight ? "text-neutral-900 font-bold" : "text-white font-bold")
                    : (isLight ? "text-neutral-900/80" : "text-white/75")
                    }`}>
                    {stepName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Headlights theme toggle (bottom left) */}
      <div className="pointer-events-auto fixed bottom-16 sm:bottom-5 left-4 sm:left-12 z-20 select-none">
        <div className={`relative flex rounded-full border p-1 shadow-lg backdrop-blur-md transition-all duration-300 ${isLight
          ? "border-neutral-900/15 bg-transparent shadow-neutral-900/5"
          : "border-white/10 bg-transparent shadow-black/40"
          }`}>
          <div
            className={`absolute top-[4px] bottom-[4px] w-[calc(50%-4px)] rounded-full transition-all duration-300 ease-in-out border ${isLight
              ? "left-[4px] border-neutral-950 bg-white shadow-sm"
              : "left-[50%] border-white bg-white/10 shadow-sm"
              }`}
          />
          <button
            onClick={() => toggleTheme("light")}
            aria-label="Light mode"
            className={`relative z-10 rounded-full p-2 transition-all duration-300 ${isLight ? "text-neutral-900" : "text-white/45 hover:text-white"
              }`}
          >
            <HeadlampOnIcon />
          </button>
          <button
            onClick={() => toggleTheme("dark")}
            aria-label="Dark mode"
            className={`relative z-10 rounded-full p-2 transition-all duration-300 ${!isLight ? "text-white" : "text-neutral-500 hover:text-neutral-900"
              }`}
          >
            <HeadlampOffIcon />
          </button>
        </div>
      </div>

      {/* Shared contact popup + flying logo (the same component the landing page uses). */}
      <ContactPopup
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        isLight={isLight}
        accent={accent}
        headerLogoRef={logoContainerRef}
        logoSize={28}
      />

      {/* Custom vehicle selection overlay — blurs the page and allows search input */}
      <div
        ref={customOverlayRef}
        onClick={() => setCustomCarOpen(false)}
        aria-hidden={!customCarOpen}
        className="fixed inset-0 z-[60] flex items-center justify-center px-4"
        style={{
          pointerEvents: "none",
          backdropFilter: "blur(0px)",
          WebkitBackdropFilter: "blur(0px)",
          backgroundColor: "transparent",
          display: "none",
        }}
      >
        <div
          ref={customCardRef}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Other Options Search"
          className={`relative w-full max-w-md rounded-[2rem] sm:rounded-[2.5rem] border p-6 sm:p-8 shadow-lg backdrop-blur-xl ${
            isLight
              ? "bg-white/80 border-neutral-900/10 text-neutral-900 shadow-neutral-900/5"
              : "bg-neutral-950/70 border-white/10 text-white shadow-black/30"
          }`}
        >
          <button
            type="button"
            onClick={() => setCustomCarOpen(false)}
            className={`absolute right-5 top-5 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200 ${
              isLight ? "text-neutral-900/40 hover:text-neutral-900" : "text-white/40 hover:text-white"
            }`}
          >
            Close
          </button>

          <div className="text-center mb-6">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2"
              style={{ color: isLight ? "#00209C" : "#FDBA16" }}
            >
              Other Options
            </div>
            <h2 className={`text-2xl font-light tracking-tight ${isLight ? "text-neutral-900" : "text-white"}`}>
              Put in the car
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelStyle}>Desired Vehicle Model *</label>
              <input
                type="text"
                value={customCarInput}
                onChange={(e) => {
                  setCustomCarInput(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="e.g. Mercedes C Class, Toyota Highlander"
                className={modalInputStyle}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customCarInput.trim()) {
                    selectCustomCar(customCarInput);
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className={labelStyle}>Model Year (Optional)</label>
              <input
                type="text"
                maxLength={4}
                value={customCarYear}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setCustomCarYear(val);
                }}
                placeholder="e.g. 2025"
                className={modalInputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customCarInput.trim()) {
                    selectCustomCar(customCarInput);
                  }
                }}
              />
            </div>

            {/* Suggestions wrapper with smooth transitions */}
            {showSuggestions && customCarInput.trim() !== "" && (
              <div className={`mt-3 p-3 rounded-2xl border transition-all duration-300 ${
                isLight 
                  ? "bg-neutral-50/80 border-neutral-950/5 shadow-inner" 
                  : "bg-neutral-900/40 border-white/5 shadow-inner"
              }`}>
                <div className={`text-[9px] font-bold uppercase tracking-wider px-2 mb-2 ${isLight ? "text-neutral-500" : "text-white/40"}`}>
                  Suggestions
                </div>
                <div className="flex flex-col gap-1.5">
                  {getSuggestions().map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setCustomCarInput(suggestion);
                        setShowSuggestions(false);
                      }}
                      className={`w-full text-left py-2 px-3 rounded-xl transition-all duration-200 flex items-center justify-between text-xs ${
                        isLight
                          ? "hover:bg-[#00209C]/5 text-neutral-800 hover:text-[#00209C]"
                          : "hover:bg-[#FDBA16]/5 text-neutral-200 hover:text-[#FDBA16]"
                      }`}
                    >
                      <span className="font-semibold">{suggestion}</span>
                      <span className="opacity-60 text-[10px] font-bold tracking-widest uppercase">Autofill</span>
                    </button>
                  ))}
                  {getSuggestions().length === 0 && (
                    <div className={`px-2 py-1 text-xs italic ${isLight ? "text-neutral-500" : "text-white/45"}`}>
                      Custom request: "{customCarInput}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {customCarInput.trim() === "" && (
              <div className={`text-center py-4 text-xs font-light ${isLight ? "text-neutral-900/35" : "text-white/30"}`}>
                Start typing to see autocomplete suggestions
              </div>
            )}

            {/* Confirm button */}
            <div className="mt-4 flex justify-center">
              <CtaButton
                isLight={isLight}
                disabled={!customCarInput.trim()}
                onClick={() => selectCustomCar(customCarInput)}
              >
                Confirm
              </CtaButton>
            </div>
          </div>
        </div>
      </div>

      {/* Custom pickup location popup (Step 2 "Customize location") */}
      <div
        onClick={() => setCustomLocationOpen(false)}
        aria-hidden={!customLocationOpen}
        className={`fixed inset-0 z-[60] flex items-center justify-center px-4 transition-opacity duration-300 ${
          customLocationOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          backgroundColor: customLocationOpen ? "rgba(0,0,0,0.30)" : "transparent",
          backdropFilter: customLocationOpen ? "blur(4px)" : "blur(0px)",
          WebkitBackdropFilter: customLocationOpen ? "blur(4px)" : "blur(0px)",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Custom Pickup Location"
          className={`relative w-full max-w-md rounded-[2rem] sm:rounded-[2.5rem] border p-6 sm:p-8 shadow-lg backdrop-blur-xl transition-all duration-300 ${
            customLocationOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-2"
          } ${
            isLight
              ? "bg-white/80 border-neutral-900/10 text-neutral-900 shadow-neutral-900/5"
              : "bg-neutral-950/70 border-white/10 text-white shadow-black/30"
          }`}
        >
          <button
            type="button"
            onClick={() => setCustomLocationOpen(false)}
            className={`absolute right-5 top-5 text-[11px] font-semibold uppercase tracking-widest transition-colors duration-200 ${
              isLight ? "text-neutral-900/40 hover:text-neutral-900" : "text-white/40 hover:text-white"
            }`}
          >
            Close
          </button>

          <div className="text-center mb-6">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2"
              style={{ color: isLight ? "#00209C" : "#FDBA16" }}
            >
              Customize
            </div>
            <h2 className={`text-2xl font-light tracking-tight ${isLight ? "text-neutral-900" : "text-white"}`}>
              Enter your pickup spot
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <div className="relative flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className={labelStyle}>Street / Area Address *</label>
                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={locationLocating}
                  className="flex items-center gap-1 text-[11px] font-semibold tracking-wide transition-opacity duration-200 hover:opacity-80 disabled:opacity-50"
                  style={{ color: isLight ? "#00209C" : "#FDBA16" }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                  {locationLocating ? "Locating…" : "Use current location"}
                </button>
              </div>
              <input
                ref={customLocationInputRef}
                type="text"
                value={customLocationInput}
                autoComplete="off"
                onChange={(e) => {
                  setCustomLocationInput(e.target.value);
                  setLocationPicked(null);
                }}
                placeholder="Search a street or area — e.g. Bourdillon Road, Ikoyi"
                className={modalInputStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && locationResults.length > 0) {
                    e.preventDefault();
                    pickLocationResult(locationResults[0]);
                  }
                }}
              />

              {/* OpenStreetMap search suggestions — translucent, blurred, compact */}
              {(locationResults.length > 0 || locationSearching) && (
                <div
                  className={`absolute left-0 right-0 top-full z-30 mt-2 max-h-44 overflow-y-auto rounded-xl border backdrop-blur-xl ${
                    isLight ? "bg-white/55 border-neutral-900/10" : "bg-neutral-900/40 border-white/10"
                  }`}
                >
                  {locationSearching && locationResults.length === 0 && (
                    <div className={`px-3 py-2 text-[11px] ${isLight ? "text-neutral-900/50" : "text-white/45"}`}>
                      Searching…
                    </div>
                  )}
                  {locationResults.map((r, i) => (
                    <button
                      key={`${r.lat}-${r.lon}-${i}`}
                      type="button"
                      onClick={() => pickLocationResult(r)}
                      className={`block w-full text-left px-3 py-2 text-[11px] leading-snug transition-colors duration-150 ${
                        isLight ? "text-neutral-800 hover:bg-[#00209C]/[0.08]" : "text-neutral-200 hover:bg-[#FDBA16]/[0.10]"
                      }`}
                    >
                      {r.display_name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {locationError && (
              <div className={`-mt-2 text-[11px] ${isLight ? "text-red-600" : "text-red-400"}`}>{locationError}</div>
            )}

            {/* Live satellite preview — lit to the location's current Nigeria time, accent pin */}
            {customLocationOpen && (
              <PickupMapEmbed
                lng={locationPicked?.lng ?? null}
                lat={locationPicked?.lat ?? null}
                isLight={isLight}
                accent={isLight ? "#00209C" : "#FDBA16"}
              />
            )}

            <div className="flex flex-col gap-1.5">
              <label className={labelStyle}>Nearby Landmark (Optional)</label>
              <input
                type="text"
                value={customLocationLandmark}
                onChange={(e) => setCustomLocationLandmark(e.target.value)}
                placeholder="e.g. opposite Eko Hotel, beside Shoprite"
                className={modalInputStyle}
              />
              <p className={`text-[10px] leading-relaxed ${isLight ? "text-neutral-900/45" : "text-white/40"}`}>
                A well-known spot nearby helps your chauffeur find you — maps can&apos;t always pin an exact house number.
              </p>
            </div>

            <div className="mt-1 flex justify-center">
              <CtaButton isLight={isLight} disabled={!locationPicked} onClick={selectCustomLocation}>
                Confirm
              </CtaButton>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
