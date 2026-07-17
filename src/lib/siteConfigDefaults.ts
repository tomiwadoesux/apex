// The editable site options and their code defaults. The admin panel stores an
// override of this shape (see src/lib/siteConfig.ts); the booking form and the
// Quick Booking popup fetch /api/config and fall back to these when a field was
// never edited. Plain data only — imported by both client and server code.

import { RATE_PER_HOUR } from "./pricing";
import { PAYMENT } from "./payment";

export type ConfigCar = {
  id: string;
  name: string;
  year: string;
  type: string;
  specs: string[]; // e.g. ["5 seats", "AWD", "V8"]
  image: string | null; // an EXISTING /images/cars path or null (no upload, images stay code assets)
};

// ApexRide's bank details, shown on the payment step (editable in /admin).
export type PaymentInfo = { bankName: string; accountNumber: string; accountName: string };

export type SiteConfig = {
  // Step 2 — the six one-tap pickup spots (3 Lagos, 3 Abuja by default).
  popularPickups: { city: string; name: string }[];
  // Step 5 — fixed-duration tiers. Ids are FIXED (behaviour hangs off them);
  // names / descriptions / hours are editable.
  durations: { id: "6h" | "12h" | "24h" | "multiday"; name: string; desc: string; hours?: number }[];
  // Step 6 — trip-type tiers. Ids fixed, text editable.
  tripTypes: { id: "custom" | "interstate" | "airport" | "point"; name: string; desc: string }[];
  // Step 8 — the quick-add request chips (free add/remove).
  quickRequests: string[];
  // Cars ADDED by the team (they appear in the form's all-cars list and in
  // Quick Booking, quote-on-request when they have no photo).
  extraCars: ConfigCar[];
  // Built-in photographed cars HIDDEN from the pickers (by exact name).
  hiddenCars: string[];
  // Car ids shown in Quick Booking's opening list. Empty → every available car.
  quickCars: string[];
  // Per-hour chauffeur rate in Naira, keyed by fleet variant id (or extra-car id).
  // Shown beside each car in Quick Booking. Missing id → the code default.
  carRates: Record<string, number>;
  // Flat Naira fare for each trip type (no hourly duration) — keyed by trip-type
  // id (custom / interstate / airport / point). Used to charge these via Paystack.
  tripRates: Record<string, number>;
  // Quick Booking prices per car: the Airport Pickup fare and the 12-hour fare,
  // both in Naira, keyed by fleet variant id. Shown on the car step.
  qbRates: Record<string, { airport: number; hours12: number }>;
  // ApexRide's bank details — legacy; Paystack is the live channel now.
  payment: PaymentInfo;
};

export const DEFAULT_CONFIG: SiteConfig = {
  popularPickups: [
    { city: "Lagos", name: "Murtala Muhammed Airport (MMIA), Ikeja" },
    { city: "Lagos", name: "Eko Hotel & Suites, Victoria Island" },
    { city: "Lagos", name: "Ikeja City Mall, Alausa" },
    { city: "Abuja", name: "Nnamdi Azikiwe Airport (ABV)" },
    { city: "Abuja", name: "Transcorp Hilton, Maitama" },
    { city: "Abuja", name: "Jabi Lake Mall, Jabi" },
  ],
  durations: [
    { id: "6h", name: "6 Hours", desc: "Half-day chauffeur, billed as a fixed 6-hour block.", hours: 6 },
    { id: "12h", name: "12 Hours", desc: "Full-day chauffeur across a fixed 12-hour block.", hours: 12 },
    { id: "24h", name: "24 Hours", desc: "Round-the-clock chauffeur on call for a full day.", hours: 24 },
    { id: "multiday", name: "Multiple Days", desc: "Dedicated chauffeur across the number of days you choose." },
  ],
  tripTypes: [
    { id: "custom", name: "Custom", desc: "Bespoke itinerary, tell us exactly what you need." },
    { id: "interstate", name: "Interstate", desc: "Long-distance executive transit between states." },
    { id: "airport", name: "Airport Transfer", desc: "Flat-rate transfer to or from airport terminals." },
    { id: "point", name: "Point-to-Point", desc: "Direct executive transit between custom coordinates." },
  ],
  quickRequests: [
    "Meet and greet at arrivals",
    "Child seat needed",
    "Quiet ride preferred",
    "Bottled water on board",
    "Extra stop along the way",
    "Help with my luggage",
  ],
  extraCars: [],
  hiddenCars: [],
  quickCars: [],
  carRates: { ...RATE_PER_HOUR },
  tripRates: { custom: 100000, interstate: 150000, airport: 40000, point: 60000 },
  qbRates: {
    "phantom-2023": { airport: 200000, hours12: 400000 },
    "sclass-2023": { airport: 150000, hours12: 300000 },
    "g63-2022": { airport: 150000, hours12: 300000 },
    "lx600-2024": { airport: 150000, hours12: 300000 },
    "rangerover-hse-2024": { airport: 120000, hours12: 220000 },
    "escalade-2024": { airport: 100000, hours12: 200000 },
    "velar-2023": { airport: 90000, hours12: 150000 },
    "gle53-suv-2023": { airport: 100000, hours12: 180000 },
    "gle53-coupe-2023": { airport: 100000, hours12: 180000 },
    "gx460-2019": { airport: 90000, hours12: 140000 },
    "prado-2023": { airport: 90000, hours12: 140000 },
    "hilux-2023": { airport: 100000, hours12: 150000 },
  },
  payment: { ...PAYMENT },
};

export type BookingStatus = "new" | "confirmed" | "assigned" | "completed" | "cancelled";
export const BOOKING_STATUSES: BookingStatus[] = ["new", "confirmed", "assigned", "completed", "cancelled"];
