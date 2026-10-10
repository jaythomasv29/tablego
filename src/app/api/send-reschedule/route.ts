import { validMutationOrigin } from '@/lib/auth/admin';
import { actOnReservation } from '@/lib/reservations/repository';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    const body = await request.json();
    return privateJson(await actOnReservation(body.reservationId, 'reschedule', 'guest', request.headers.get('authorization')?.replace(/^Bearer /, ''), { date: body.date, time: body.time }));
  } catch (error) { return reservationError(error); }
}
