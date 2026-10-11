import { validMutationOrigin } from '@/lib/auth/admin';
import { shareReservation } from '@/lib/reservations/shareRepository';
import { privateJson, reservationError } from '@/lib/reservations/http';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    return privateJson(await shareReservation((await context.params).id,
      request.headers.get('authorization')?.replace(/^Bearer /, ''), await request.json(), request.headers.get('Idempotency-Key')));
  } catch (error) { return reservationError(error); }
}
