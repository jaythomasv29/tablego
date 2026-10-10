import { randomUUID } from 'node:crypto';
import { validMutationOrigin, readCookie } from '@/lib/auth/admin';
import { verifySignedToken } from '@/lib/auth/signedToken';
import { rateLimit } from '@/lib/auth/rateLimit';
import { bookingInput } from '@/lib/reservations/input';
import { createReservation } from '@/lib/reservations/repository';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    let body;
    try { body = await request.json(); } catch { throw new ReservationError('Invalid JSON'); }
    let input;
    try { input = bookingInput(body?.formData); } catch (error) { throw new ReservationError((error as Error).message); }
    const proof = await verifySignedToken(readCookie(request, 'phone-verification'), 'phone');
    const verified = proof?.data.phone === input.phone;
    if (process.env.NEXT_PUBLIC_OTP_ENABLED === 'true' && !verified) throw new ReservationError('Verify your phone before submitting this request', 403);
    const limited = await rateLimit('booking', input.phone, 20, 3600);
    if (limited) return limited;
    // Older external clients remain compatible; retry protection requires a stable key.
    const key = request.headers.get('idempotency-key') || body.idempotencyKey || randomUUID();
    return privateJson(await createReservation(input, verified, body.smsOptIn === true, key));
  } catch (error) { return reservationError(error); }
}
