import { validMutationOrigin } from '@/lib/auth/admin';
import { readGuestReservation, actOnReservation } from '@/lib/reservations/repository';
import { privateJson, reservationError } from '@/lib/reservations/http';
type Context = { params: Promise<{ id: string }> };
const token = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer /, '');
export async function GET(request: Request, context: Context) {
  try { return privateJson({ reservation: await readGuestReservation((await context.params).id, token(request)) }); }
  catch (error) { return reservationError(error); }
}
export async function POST(request: Request, context: Context) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid request origin' }, 403);
  try {
    const body = await request.json();
    return privateJson(await actOnReservation((await context.params).id, body.action, 'guest', token(request), body));
  } catch (error) { return reservationError(error); }
}
