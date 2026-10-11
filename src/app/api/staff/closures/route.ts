import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { validDate } from '@/lib/reservations/availability';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const body = await request.json(), db = getServerDatabase();
    if (!['save', 'delete'].includes(body?.action) || (body.id && (typeof body.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.id)))) throw new ReservationError('Invalid closure action');
    if (body.action === 'delete') {
      if (!body.id) throw new ReservationError('Closure ID is required');
      await db.doc(`specialDates/${body.id}`).delete();
    } else {
      if (!validDate(body.date) || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.length > 200 || !['full', 'lunch', 'dinner'].includes(body.closureType)) throw new ReservationError('Enter a valid calendar date, reason and closure period');
      const ref = body.id ? db.doc(`specialDates/${body.id}`) : db.collection('specialDates').doc();
      await ref.set({ date: body.date, reason: body.reason.trim(), closureType: body.closureType });
    }
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
