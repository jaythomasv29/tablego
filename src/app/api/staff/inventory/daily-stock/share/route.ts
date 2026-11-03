import { adminSession, requireAdmin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { issueSignedToken } from '@/lib/auth/signedToken';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const session = await adminSession(request);
    if (!session) throw new ReservationError('Authentication required', 401);
    const limited = await rateLimit('daily-stock-share', session.id, 30, 3600);
    if (limited) return limited;
    const {token, claims} = await issueSignedToken('inventory-view', {scope: 'daily-stock'}, 7 * 86400);
    return privateJson({token, expiresAt: new Date(claims.expiresAt * 1000).toISOString()});
  } catch (error) { return reservationError(error); }
}
