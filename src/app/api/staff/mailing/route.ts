import { requireAdmin } from '@/lib/auth/admin';
import { loadContacts, staffUnsubscribe } from '@/lib/mailing/repository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const result = await loadContacts();
    return privateJson(new URL(request.url).searchParams.get('summary') === '1' ? { counts: result.counts } : result);
  } catch (error) { return reservationError(error); }
}
export async function PATCH(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const raw = await request.text(); if (raw.length > 1024) throw new ReservationError('Invalid request.', 413);
    const body = JSON.parse(raw);
    if (!body || body.action !== 'unsubscribe' || typeof body.id !== 'string') throw new ReservationError('Choose a contact to unsubscribe.');
    await staffUnsubscribe(body.id, body.version);
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
