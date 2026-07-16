// GET /api/paystack/config — hands the client the Paystack PUBLIC key at runtime.
// Read server-side from env (any of the usual names), so the pay button works
// the moment the key is set in Vercel — no rebuild needed, and it's forgiving of
// whether the var was named with the NEXT_PUBLIC_ prefix or not. The public key
// is safe to expose (that's its purpose); the secret key never leaves the server.

export const runtime = "nodejs";

export async function GET() {
  const publicKey =
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || process.env.PAYSTACK_PUBLIC_KEY || "";
  return Response.json({ publicKey }, { headers: { "Cache-Control": "no-store" } });
}
