// Server-side proxy for OpenStreetMap (Nominatim) address search.
// Going through our own origin avoids browser CORS/ad-block failures and lets us
// send a policy-compliant User-Agent identifying the app. Nigeria-biased to match
// the service area. Route Handlers aren't cached by default.

type NominatimHit = { display_name: string; lat: string; lon: string };

const HEADERS = {
  "User-Agent": "ApexRide-Booking/1.0 (pickup address search)",
  "Accept-Language": "en",
};
const pick = (d: NominatimHit): NominatimHit => ({
  display_name: d.display_name,
  lat: d.lat,
  lon: d.lon,
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lat = params.get("lat");
  const lon = params.get("lon");

  // Reverse geocode — used by "Use current location" (coords → address).
  if (lat && lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
        { headers: HEADERS, cache: "no-store" }
      );
      if (!res.ok) return Response.json([]);
      const d = await res.json();
      return Response.json(d && d.display_name ? [pick(d)] : []);
    } catch {
      return Response.json([]);
    }
  }

  // Forward search — typed address → matches.
  const q = params.get("q")?.trim() ?? "";
  if (q.length < 3) return Response.json([]);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ng&q=${encodeURIComponent(q)}`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!res.ok) return Response.json([]);
    const data = await res.json();
    return Response.json(Array.isArray(data) ? data.map(pick) : []);
  } catch {
    return Response.json([]);
  }
}
