import { randomUUID } from 'node:crypto';
import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { businessTimezone } from '@/lib/reservations/policy';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { cateringLead, cateringRecord, cateringUpdate, closedCatering } from '@/lib/catering/admin';
import { timestampString } from '@/lib/reservations/service';
type Context = { params: Promise<{ id: string }> };
function leadId(id: string) { if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new ReservationError('Invalid inquiry', 400); return id; }
export async function GET(request: Request, context: Context) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const db = getServerDatabase(), ref = db.doc(`catering/${leadId((await context.params).id)}`);
    const [record, staffRecord, settings, events] = await Promise.all([ref.get(), db.doc(`cateringStaff/${ref.id}`).get(), db.doc('settings/general').get(), ref.collection('events').orderBy('timestamp', 'desc').limit(20).get()]);
    if (!record.exists) throw new ReservationError('Inquiry not found', 404);
    const timezone = businessTimezone(settings.data());
    return privateJson({ timezone, lead: cateringLead(ref.id, cateringRecord(record.data()!, staffRecord.data()), timezone), events: events.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, event: typeof data.event === 'string' ? data.event.slice(0, 80) : 'catering.updated', timestamp: timestampString(data.timestamp),
        previousStatus: typeof data.previousStatus === 'string' && Object.hasOwn(cateringStatusKeys, data.previousStatus) ? data.previousStatus : null,
        status: typeof data.status === 'string' && Object.hasOwn(cateringStatusKeys, data.status) ? data.status : null, notesChanged: data.notesChanged === true, bulkClosed: typeof data.bulkOperationId === 'string',
        followUpChanged: data.followUpChanged === true, followUpDate: typeof data.followUpDate === 'string' ? data.followUpDate.slice(0, 10) : '',
        recipient: data.recipient === 'guest' || data.recipient === 'restaurant' ? data.recipient : null };
    }) });
  } catch (error) { return reservationError(error); }
}
const cateringStatusKeys = { pending: true, contacted: true, confirmed: true, completed: true, declined: true, 'needs-review': true };
export async function PATCH(request: Request, context: Context) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    let update; try { update = cateringUpdate(await request.json()); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid update'); }
    const db = getServerDatabase(), ref = db.doc(`catering/${leadId((await context.params).id)}`), staffRef = db.doc(`cateringStaff/${ref.id}`);
    const result = await db.runTransaction(async tx => {
      const [record, staffRecord, settings] = await Promise.all([tx.get(ref), tx.get(staffRef), tx.get(db.doc('settings/general'))]);
      if (!record.exists) throw new ReservationError('Inquiry not found', 404);
      const timezone = businessTimezone(settings.data()), combined = cateringRecord(record.data()!, staffRecord.data()), current = cateringLead(ref.id, combined, timezone);
      if (current.version !== update.version || current.status !== update.originalStatus) throw new ReservationError('Another staff member changed this inquiry. Your draft is kept; reload the saved inquiry before trying again.', 409);
      const notesChanged = current.internalNotes !== update.internalNotes, followUpChanged = current.followUpDate !== update.followUpDate, statusChanged = current.status !== update.status;
      if (!notesChanged && !followUpChanged && !statusChanged) return { lead: current, changed: false };
      const patch = { workflowStage: update.status, internalNotes: update.internalNotes, followUpDate: update.followUpDate, version: current.version + 1, updatedAt: new Date() };
      const legacy = { status: closedCatering(update.status) ? 'completed' : 'pending', version: patch.version, updatedAt: patch.updatedAt };
      tx.set(staffRef, patch, { merge: true });
      tx.update(ref, legacy);
      tx.create(ref.collection('events').doc(randomUUID()), { event: 'catering.updated', actor: 'staff', timestamp: new Date(), previousStatus: current.status, status: update.status, notesChanged, followUpChanged, followUpDate: update.followUpDate });
      return { lead: cateringLead(ref.id, { ...combined, ...patch, ...legacy }, timezone), changed: true };
    });
    return privateJson({ success: true, ...result });
  } catch (error) { return reservationError(error); }
}
