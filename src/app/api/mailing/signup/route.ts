import { validMutationOrigin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { SIGNUP_MESSAGE, signupInput } from '@/lib/mailing/policy';
import { requestSignup } from '@/lib/mailing/repository';
import { scheduleDelivery } from '@/lib/reservations/background';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    const raw = await request.text(); if (raw.length > 2048) throw new ReservationError('Signup is too large.', 413);
    let input; try { input = signupInput(JSON.parse(raw)); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid signup.'); }
    const ipLimit = await rateLimit('mailing-signup-ip', request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', 12, 3600); if (ipLimit) return ipLimit;
    if (!input.honeypot) {
      const emailLimit = await rateLimit('mailing-signup-email', input.email, 3, 86400);
      if (emailLimit && emailLimit.status !== 429) return emailLimit;
      // Do not expose whether an address has already requested a confirmation.
      if (!emailLimit) { const event = await requestSignup(input.email, input.source); if (event) scheduleDelivery(event); }
    }
    return privateJson({ success: true, message: SIGNUP_MESSAGE });
  } catch (error) { return reservationError(error); }
}
