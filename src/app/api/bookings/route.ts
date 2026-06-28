// POST /api/bookings — save a booking and return its unique reference.
// Runs on the Node runtime so the file-store fallback (fs) works in local dev.

import { createBooking, type BookingInput } from "@/lib/bookings";

export const runtime = "nodejs";

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");
const strOrNull = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.slice(0, max) : null);

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const car = (body.car ?? {}) as Record<string, unknown>;
  const passenger = (body.passenger ?? {}) as Record<string, unknown>;

  const input: BookingInput = {
    passenger: {
      name: str(passenger.name, 80),
      phone: str(passenger.phone, 40),
      email: str(passenger.email, 120),
    },
    car: {
      name: str(car.name, 80),
      klass: str(car.klass, 80),
      image: strOrNull(car.image, 300),
    },
    service: str(body.service, 80),
    pickup: str(body.pickup, 200),
    dropoff: strOrNull(body.dropoff, 200),
    duration: strOrNull(body.duration, 80),
    date: str(body.date, 60),
    time: str(body.time, 20),
    light: Boolean(body.light),
  };

  if (!input.pickup || !input.car.name || !input.service) {
    return Response.json({ error: "Missing required booking fields" }, { status: 400 });
  }

  try {
    const booking = await createBooking(input);
    return Response.json({ booking }, { status: 201 });
  } catch (err) {
    console.error("[bookings] create failed", err);
    return Response.json({ error: "Could not save booking" }, { status: 500 });
  }
}
