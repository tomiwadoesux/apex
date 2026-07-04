// The editable site options and their code defaults. The admin panel stores an
// override of this shape (see src/lib/siteConfig.ts); the booking form and the
// Quick Booking popup fetch /api/config and fall back to these when a field was
// never edited. Plain data only — imported by both client and server code.

export type ConfigCar = {
  id: string;
  name: string;
  year: string;
  type: string;
  specs: string[]; // e.g. ["5 seats", "AWD", "V8"]
  image: string | null; // an EXISTING /images/cars path or null (no upload — images stay code assets)
};

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
    { id: "custom", name: "Custom", desc: "Bespoke itinerary — tell us exactly what you need." },
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
};

export type BookingStatus = "new" | "confirmed" | "assigned" | "completed" | "cancelled";
export const BOOKING_STATUSES: BookingStatus[] = ["new", "confirmed", "assigned", "completed", "cancelled"];
