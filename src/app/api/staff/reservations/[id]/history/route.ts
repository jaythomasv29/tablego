import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { reservationId } from '@/lib/reservations/repository';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const ref = getServerDatabase().doc(`reservations/${reservationId((await context.params).id)}`);
    const [record, events] = await Promise.all([ref.get(), ref.collection('events').orderBy('timestamp', 'desc').limit(100).get()]);
    if (!record.exists) throw new ReservationError('Reservation not found', 404);
    return privateJson({ internalNotes: record.data()!.internalNotes || '', noteVersion: record.data()!.noteVersion || 0,
      events: events.docs.map(doc => { const data = doc.data(); return { id: doc.id, event: data.event, actor: data.actor,
        timestamp: data.timestamp?.toDate().toISOString() || null, previousStatus: data.previousStatus || null, status: data.status || null,
        channel: data.channel || null, recipient: data.recipient || null }; }) });
  } catch (error) { return reservationError(error); }
}
export async function PATCH(request: Request, context: Context) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const body = await request.json(), id = reservationId((await context.params).id);
    if (typeof body?.internalNotes !== 'string' || body.internalNotes.length > 2000 || !Number.isInteger(body.noteVersion) || body.noteVersion < 0) throw new ReservationError('Notes must be 2,000 characters or fewer with a valid version');
    const db = getServerDatabase(), ref = db.doc(`reservations/${id}`);
    await db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data();
      if (!record) throw new ReservationError('Reservation not found', 404);
      if ((record.noteVersion || 0) !== body.noteVersion) throw new ReservationError('Another staff member changed these notes. Reload before saving.', 409);
      const notes = body.internalNotes.trim();
      if ((record.internalNotes || '') === notes) return;
      tx.update(ref, { internalNotes: notes, noteVersion: (record.noteVersion || 0) + 1 });
      tx.create(ref.collection('events').doc(randomUUID()), { event: 'reservation.internal_note_updated', actor: 'staff', timestamp: new Date() });
    });
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
