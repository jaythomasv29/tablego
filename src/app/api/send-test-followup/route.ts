import { requireAdmin } from '@/lib/auth/admin';
import { queueFollowUp } from '@/lib/reservations/feedbackRepository';
import { getServerDatabase } from '@/lib/serverFirebase';
import { reservationId } from '@/lib/reservations/repository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  if (process.env.TABLEGO_ENVIRONMENT !== 'staging') return privateJson({ error: 'Follow-up tests are staging only' }, 403);
  try {
    const body = await request.json(), id = reservationId(body.reservationId);
    if ((await getServerDatabase().doc('reservations/' + id).get()).data()?.isTest !== true) throw new ReservationError('Choose a synthetic test visit', 403);
    return privateJson(await queueFollowUp(id));
  } catch (error) { return reservationError(error); }
}
