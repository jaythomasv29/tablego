import { after } from 'next/server';
import { adminSession, requireAdmin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { deliverNotification } from '@/lib/reservations/notifications';
import { marketingTestConfiguration, marketingTestStatus, queueMarketingTest } from '@/lib/marketing/testRepository';
export const maxDuration = 60;
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return privateJson(await marketingTestConfiguration());
    const session = await adminSession(request);
    if (!session) throw new ReservationError('Authentication required', 401);
    return privateJson(await marketingTestStatus(id, session.id));
  } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const session = await adminSession(request);
    if (!session) throw new ReservationError('Authentication required', 401);
    const limited = await rateLimit('marketing-test', session.id, 5, 900); if (limited) return limited;
    const result = await queueMarketingTest(await request.json(), session.id);
    after(async () => { await deliverNotification(result.id); });
    return privateJson(result);
  } catch (error) { return reservationError(error); }
}
