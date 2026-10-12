import { validMutationOrigin, readCookie } from '@/lib/auth/admin';
import { verifySignedToken } from '@/lib/auth/signedToken';
import { rateLimit } from '@/lib/auth/rateLimit';
import { recoverFeedback } from '@/lib/reservations/feedbackRepository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    const proof = await verifySignedToken(readCookie(request, 'phone-verification'), 'phone');
    if (!proof?.data.phone) throw new ReservationError('Verify the booking phone first', 403);
    const denied = await rateLimit('feedback-recovery', proof.data.phone, 10, 3600); if (denied) return denied;
    return privateJson(await recoverFeedback((await context.params).id, proof.data.phone));
  } catch (error) { return reservationError(error); }
}
