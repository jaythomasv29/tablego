import { validMutationOrigin, readCookie } from '@/lib/auth/admin';
import { verifySignedToken } from '@/lib/auth/signedToken';
import { rateLimit } from '@/lib/auth/rateLimit';
import { recoverReservation } from '@/lib/reservations/repository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    const proof = await verifySignedToken(readCookie(request, 'phone-verification'), 'phone');
    if (!proof?.data.phone) throw new ReservationError('Verify the phone used for this reservation first', 403);
    const limited = await rateLimit('recovery', proof.data.phone, 10, 3600);
    if (limited) return limited;
    return privateJson(await recoverReservation((await context.params).id, proof.data.phone));
  } catch (error) { return reservationError(error); }
}
