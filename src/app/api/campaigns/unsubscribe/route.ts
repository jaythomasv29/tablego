import { validMutationOrigin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { unsubscribeCampaign } from '@/lib/campaigns/repository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  const limited = await rateLimit('campaign-unsubscribe', request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown', 60, 3600); if (limited) return limited;
  try {
    const raw = await request.text(); if (raw.length > 1024) throw new ReservationError('Invalid request.', 413);
    const oneClick = request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded') && new URLSearchParams(raw).get('List-Unsubscribe') === 'One-Click';
    const token = oneClick ? new URL(request.url).searchParams.get('token') : JSON.parse(raw)?.token;
    await unsubscribeCampaign(token);
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
