import { verifySignedToken } from '@/lib/auth/signedToken';
import { rateLimit } from '@/lib/auth/rateLimit';
import { getDailyStock } from '@/lib/inventory/dailyStockRepository';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
    const claims = await verifySignedToken(token, 'inventory-view');
    if (!claims || claims.data.scope !== 'daily-stock')
      throw new ReservationError('This stock link is invalid or has expired. Ask a manager for a new link.', 401);
    const limited = await rateLimit('daily-stock-view', claims.id, 240, 60);
    if (limited) return limited;
    return privateJson(await getDailyStock());
  } catch (error) { return reservationError(error); }
}
