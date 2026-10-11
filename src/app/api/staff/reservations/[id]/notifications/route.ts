import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { reservationId } from '@/lib/reservations/repository';
import { scheduleDelivery } from '@/lib/reservations/background';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { randomUUID } from 'node:crypto';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const id = reservationId((await context.params).id);
    const records = await getServerDatabase().collection('notificationOutbox').where('reservationId', '==', id).get();
    return privateJson({ notifications: records.docs.map(doc => {
      const record = doc.data();
      return { id: doc.id, event: record.event, channel: record.channel || 'email', recipient: record.kind === 'reservation-share' ? record.recipientEmail : record.recipient, state: record.state,
        deliveryMode: record.deliveryMode || null, attempts: record.attempts, lastError: record.lastError || null, createdAt: record.createdAt?.toDate().toISOString(), lastAttemptAt: record.lastAttemptAt?.toDate().toISOString() || null };
    }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')) });
  } catch (error) { return reservationError(error); }
}
export async function POST(request: Request, context: Context) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const id = reservationId((await context.params).id), { notificationId } = await request.json();
    if (typeof notificationId !== 'string' || !/^[a-f0-9-]{36}-(guest|restaurant)$/.test(notificationId)) throw new ReservationError('Invalid notification');
    const db = getServerDatabase(), ref = db.doc(`notificationOutbox/${notificationId}`);
    await db.runTransaction(async tx => {
      const data = (await tx.get(ref)).data();
      if (!data || data.reservationId !== id) throw new ReservationError('Notification not found', 404);
      if (!['failed', 'exhausted'].includes(data.state)) throw new ReservationError('Only failed notifications can be retried', 409);
      tx.update(ref, { state: 'queued', attempts: 0, previousAttempts: (data.previousAttempts || 0) + data.attempts, nextAttemptAt: new Date(), lastError: null });
      tx.create(db.doc(`reservations/${id}/events/${randomUUID()}`), { event: 'notification.retry_requested', actor: 'staff', notificationId, timestamp: new Date() });
    });
    scheduleDelivery(notificationId.replace(/-(guest|restaurant)$/, ''));
    return privateJson({ success: true, queued: true });
  } catch (error) { return reservationError(error); }
}
