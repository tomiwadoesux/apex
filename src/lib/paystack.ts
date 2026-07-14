// Paystack verification. Payment is collected on the client with Paystack Inline
// (the popup, using NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY); the browser then hands us
// the transaction reference, which we verify here server-side with the SECRET
// key before trusting that the money actually arrived. Server-only.

const SECRET = process.env.PAYSTACK_SECRET_KEY;

export const paystackConfigured = () => Boolean(SECRET);

export type PaystackVerification = {
  status: string; // "success" when paid
  amount: number; // in kobo
  reference: string;
  currency: string;
  metadata?: { bookingId?: string } | null;
  customer?: { email?: string } | null;
};

export async function verifyTransaction(reference: string): Promise<PaystackVerification | null> {
  if (!SECRET) throw new Error("PAYSTACK_SECRET_KEY is not set");
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${SECRET}` },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; data?: PaystackVerification } | null;
  if (!res.ok || !json?.status) return null;
  return json.data ?? null;
}
