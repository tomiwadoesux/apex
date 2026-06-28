// Shared fleet roster, grouped by MODEL. Some model years have no photo of their own,
// but a sibling variant does — so we group variants under one model and let the stage
// fall back to the model's available photo. That keeps the picker free of empty tiles.
//
// Photos live in /public/images/cars/<model>/ (side.webp, or front.webp where there's
// no side shot). Every shot faces LEFT, so the page renders them un-flipped; `flip:true`
// mirrors one if ever needed.

export type Variant = {
  id: string;
  label: string;        // chip text in the year / variant selector
  name: string;         // full model name handed to the booking form
  year: number;
  type: string;
  specs: string[];
  image: string | null; // its own photo, or null → the group's photo stands in
  flip?: boolean;
};

export type CarGroup = {
  id: string;
  name: string;         // heading shown on the stage
  image: string;        // the model's representative photo (always present)
  variants: Variant[];  // one or more year / trim variants
};

export const GROUPS: CarGroup[] = [
  {
    id: "phantom",
    name: "Rolls Royce Phantom",
    image: "/images/cars/Rolls Royce Phantom/front.webp",
    variants: [
      { id: "phantom-2023", label: "2023", name: "Rolls Royce Phantom", year: 2023, type: "Ultra luxury sedan", specs: ["5 seats", "Auto", "V12"], image: "/images/cars/Rolls Royce Phantom/front.webp" },
    ],
  },
  {
    id: "lexus-lx",
    name: "Lexus LX",
    image: "/images/cars/Lexus LX 570 2024/side.webp",
    variants: [
      { id: "lx600-2024", label: "LX 600 · 2024", name: "Lexus LX 600", year: 2024, type: "Full size luxury SUV", specs: ["7 seats", "AWD", "Twin turbo V6"], image: "/images/cars/Lexus LX 570 2024/side.webp" },
      { id: "lx570-2019", label: "LX 570 · 2019", name: "Lexus LX 570", year: 2019, type: "Full size luxury SUV", specs: ["8 seats", "4WD", "V8"], image: null },
    ],
  },
  {
    id: "g63",
    name: "Mercedes AMG G63",
    image: "/images/cars/Mercedes G63 2022/side.webp",
    variants: [
      { id: "g63-2022", label: "2022", name: "Mercedes AMG G63", year: 2022, type: "Luxury SUV", specs: ["5 seats", "AWD", "Twin turbo V8"], image: "/images/cars/Mercedes G63 2022/side.webp" },
    ],
  },
  {
    id: "rr-hse",
    name: "Range Rover HSE",
    image: "/images/cars/Range Rover HSE 2024/side.webp",
    variants: [
      { id: "rangerover-hse-2024", label: "2024", name: "Range Rover HSE", year: 2024, type: "Full size luxury SUV", specs: ["5 seats", "AWD", "Mild hybrid"], image: "/images/cars/Range Rover HSE 2024/side.webp" },
    ],
  },
  {
    id: "escalade",
    name: "Cadillac Escalade",
    image: "/images/cars/Escalade 2024/side.webp",
    variants: [
      { id: "escalade-2024", label: "2024", name: "Cadillac Escalade", year: 2024, type: "Full size luxury SUV", specs: ["7 seats", "4WD", "V8"], image: "/images/cars/Escalade 2024/side.webp" },
    ],
  },
  {
    id: "velar",
    name: "Range Rover Velar",
    image: "/images/cars/Range Rover Velar/side.webp",
    variants: [
      { id: "velar-2023", label: "2023", name: "Range Rover Velar", year: 2023, type: "Compact luxury SUV", specs: ["5 seats", "AWD", "Turbo"], image: "/images/cars/Range Rover Velar/side.webp" },
    ],
  },
  {
    id: "gle53",
    name: "Mercedes AMG GLE 53",
    image: "/images/cars/Mercedes GLE 53 2023 SUV/side.webp",
    variants: [
      { id: "gle53-suv-2023", label: "SUV · 2023", name: "Mercedes AMG GLE 53 SUV", year: 2023, type: "Luxury SUV", specs: ["5 seats", "AWD", "Inline 6"], image: "/images/cars/Mercedes GLE 53 2023 SUV/side.webp" },
      { id: "gle53-coupe-2023", label: "Coupe · 2023", name: "Mercedes AMG GLE 53 Coupe", year: 2023, type: "Coupe SUV", specs: ["5 seats", "AWD", "Inline 6"], image: "/images/cars/Mercedes GLE 53 2023 Coupe/front.webp" },
    ],
  },
  {
    id: "gx460",
    name: "Lexus GX 460",
    image: "/images/cars/Lexus GX 460 2019/side.webp",
    variants: [
      { id: "gx460-2019", label: "2019", name: "Lexus GX 460", year: 2019, type: "Midsize luxury SUV", specs: ["7 seats", "4WD", "V8"], image: "/images/cars/Lexus GX 460 2019/side.webp" },
      { id: "gx460-2024", label: "2024", name: "Lexus GX 460", year: 2024, type: "Midsize luxury SUV", specs: ["7 seats", "4WD", "Twin turbo V6"], image: null },
    ],
  },
  {
    id: "prado",
    name: "Toyota Prado Land Cruiser",
    image: "/images/cars/Prado Land Cruiser 2023/side.webp",
    variants: [
      { id: "prado-2023", label: "2023", name: "Toyota Prado Land Cruiser", year: 2023, type: "Midsize SUV", specs: ["7 seats", "4WD", "V6"], image: "/images/cars/Prado Land Cruiser 2023/side.webp" },
      { id: "prado-2019", label: "2019", name: "Toyota Prado Land Cruiser", year: 2019, type: "Midsize SUV", specs: ["7 seats", "4WD", "V6"], image: null },
      { id: "prado-2024", label: "2024", name: "Toyota Prado Land Cruiser", year: 2024, type: "Midsize SUV", specs: ["7 seats", "4WD", "Turbo"], image: null },
      { id: "prado-upgraded", label: "Upgraded · 2023", name: "Toyota Prado Land Cruiser Upgraded", year: 2023, type: "Midsize SUV", specs: ["7 seats", "4WD", "V6"], image: null },
    ],
  },
  {
    id: "hilux",
    name: "Toyota Hilux",
    image: "/images/cars/Hilux 2023/side.webp",
    variants: [
      { id: "hilux-2023", label: "2023", name: "Toyota Hilux", year: 2023, type: "Pickup truck", specs: ["5 seats", "4WD", "Diesel"], image: "/images/cars/Hilux 2023/side.webp" },
      { id: "hilux-2021", label: "2021", name: "Toyota Hilux", year: 2021, type: "Pickup truck", specs: ["5 seats", "4WD", "Diesel"], image: null },
    ],
  },
  {
    id: "sclass",
    name: "Mercedes Benz S Class",
    image: "/images/cars/Mercedes S-Class/side.webp",
    variants: [
      { id: "sclass-2023", label: "2023", name: "Mercedes Benz S Class", year: 2023, type: "Luxury sedan", specs: ["5 seats", "Auto", "V6"], image: "/images/cars/Mercedes S-Class/side.webp" },
    ],
  },
];

// Flat list of every variant across all groups. The booking form consumes this
// (filtering to variants that have a photo) to build its bookable vehicle list.
export const CARS: Variant[] = GROUPS.flatMap((g) => g.variants);

// The three camera angles a car can be shown from on the stage.
export type Angle = "front" | "side" | "rear";

// Every model folder with photos has front/side/rear EXCEPT these, which are
// missing one shot on disk. The stage's angle switcher dims the icon for any
// angle a car has no photo for.
const MISSING_ANGLES: Record<string, Angle[]> = {
  "Mercedes S-Class": ["front"],
  "Mercedes GLE 53 2023 Coupe": ["side"],
  "Rolls Royce Phantom": ["side"],
};

// Given a car's effective base image (its own photo, or the group's stand-in),
// return the image path for each angle — or null where that angle has no photo.
// The folder is the same for every angle; only the filename changes.
export function anglesFor(baseImage: string): Record<Angle, string | null> {
  const dir = baseImage.replace(/\/[^/]+$/, "");
  const folder = dir.split("/").pop() ?? "";
  const missing = new Set(MISSING_ANGLES[folder] ?? []);
  return {
    front: missing.has("front") ? null : `${dir}/front.webp`,
    side: missing.has("side") ? null : `${dir}/side.webp`,
    rear: missing.has("rear") ? null : `${dir}/rear.webp`,
  };
}

export const pad2 = (n: number) => String(n).padStart(2, "0");

// ease-out — the car enters quickly then settles when it slides onto the stage.
export const EASE = [0.16, 0.84, 0.44, 1] as const;
