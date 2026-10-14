import { validMutationOrigin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { changePreference } from '@/lib/mailing/repository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  const limited = await rateLimit('mailing-preferences', request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', 60, 3600); if (limited) return limited;
  try {
    const raw = await request.text(); if (raw.length > 1024) throw new ReservationError('Invalid request.', 413);
    const body = JSON.parse(raw);
    if (!body || (body.action !== 'confirm' && body.action !== 'unsubscribe') || typeof body.id !== 'string' || typeof body.token !== 'string') throw new ReservationError('Use the link from your email.');
    await changePreference(body.id, body.token, body.action);
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
