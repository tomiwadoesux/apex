// Public, read-only: the admin-edited site options the booking form and Quick
// Booking consume (falls back to code defaults when nothing was edited).

import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";

export async function GET() {
  const config = await getSiteConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "no-store" } });
}
