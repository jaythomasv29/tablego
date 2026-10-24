import { validUnsubscribe, unsubscribeMarketing } from '@/lib/marketing/repository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  try {
    const url = new URL(request.url), key = url.searchParams.get('key') || '', token = url.searchParams.get('token') || '';
    if (!validUnsubscribe(key, token)) throw new ReservationError('This unsubscribe link is invalid.', 400);
    await unsubscribeMarketing(key);
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
