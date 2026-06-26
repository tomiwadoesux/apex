// Compact solar-position math (derived from the SunCalc algorithm). Given a moment
// and a lat/lng, returns the sun's altitude and azimuth — used to grade the
// satellite map to the location's current time-of-day light. Because pickup spots
// are in Nigeria and we pass the real `new Date()`, the result reflects WAT local
// solar time without hard-coding the timezone.

const RAD = Math.PI / 180;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397; // Earth's axial tilt

function toDays(date: Date) {
  return date.valueOf() / 86400000 - 0.5 + J1970 - J2000;
}

export function sunPosition(date: Date, lat: number, lng: number) {
  const lw = RAD * -lng;
  const phi = RAD * lat;
  const d = toDays(date);

  const M = RAD * (357.5291 + 0.98560028 * d); // solar mean anomaly
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI; // ecliptic longitude
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L)); // declination
  const ra = Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY), Math.cos(L)); // right ascension
  const H = RAD * (280.16 + 360.9856235 * d) - lw - ra; // hour angle

  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  );
  // SunCalc measures azimuth from south; shift by π so 0° = north, 90° = east.
  const azimuth =
    Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)) + Math.PI;

  return {
    altitudeDeg: altitude / RAD,
    azimuthDeg: ((azimuth / RAD) % 360 + 360) % 360,
  };
}
