// Per-hour chauffeur rates, in Naira, shown in Quick Booking so guests can
// compare cars before they pick one. Keyed by fleet variant id (see
// components/fleet/data.ts). These are the numbers the site quotes — edit them
// here (or in /admin once wired) to change what customers see. Any car without
// an explicit rate falls back to DEFAULT_RATE.

export const DEFAULT_RATE = 60000;

export const RATE_PER_HOUR: Record<string, number> = {
  "phantom-2023": 200000,        // Rolls Royce Phantom
  "sclass-2023": 120000,         // Mercedes S Class
  "g63-2022": 150000,            // Mercedes AMG G63
  "lx600-2024": 90000,           // Lexus LX 600
  "lx570-2019": 80000,           // Lexus LX 570
  "escalade-2024": 90000,        // Cadillac Escalade
  "rangerover-hse-2024": 100000, // Range Rover HSE
  "velar-2023": 70000,           // Range Rover Velar
  "gle53-suv-2023": 85000,       // Mercedes AMG GLE 53 SUV
  "gle53-coupe-2023": 85000,     // Mercedes AMG GLE 53 Coupe
  "gx460-2019": 65000,           // Lexus GX 460
  "prado-2023": 60000,           // Toyota Prado Land Cruiser
  "hilux-2023": 50000,           // Toyota Hilux
};

export function ratePerHour(id: string): number {
  return RATE_PER_HOUR[id] ?? DEFAULT_RATE;
}

// "₦90,000" — Naira, grouped, no decimals.
export function naira(n: number): string {
  return "₦" + Math.round(n).toLocaleString("en-NG");
}
