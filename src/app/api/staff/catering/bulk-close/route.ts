import { createHash, randomUUID } from 'node:crypto';
import { readCookie, requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { businessTimezone } from '@/lib/reservations/policy';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { cateringLead, cateringRecord } from '@/lib/catering/admin';
import { bulkClosePlan, bulkCloseLimit, bulkCloseLifetime, cateringStamp, type BulkCloseItem } from '@/lib/catering/bulkClose';

export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const body = await request.json(), db = getServerDatabase();
    const owner = createHash('sha256').update(readCookie(request, 'company-auth') || '').digest('hex');
    if (body?.action === 'preview') {
      const [records, staffRecords, settings] = await Promise.all([db.collection('catering').get(), db.collection('cateringStaff').get(), db.doc('settings/general').get()]);
      const timezone = businessTimezone(settings.data());
      const staff = new Map(staffRecords.docs.map(doc => [doc.id, { data: doc.data(), stamp: cateringStamp(doc.updateTime) }]));
      const plan = bulkClosePlan(records.docs.map(doc => ({ id: doc.id, data: doc.data(), stamp: cateringStamp(doc.updateTime) })), staff, timezone);
      const operationId = plan.items.length ? randomUUID() : null;
      if (operationId) await db.doc(`cateringBulkClosures/${operationId}`).create({ ...plan, owner, state: 'review', createdAt: new Date(), expiresAt: Date.now() + bulkCloseLifetime });
      return privateJson({ operationId, totalActive: plan.totalActive, limit: bulkCloseLimit, timezone, items: plan.items.map(({ id, name, date, status }) => ({ id, name, date, status })) });
    }
    if (body?.action !== 'confirm' || typeof body.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(body.operationId)) throw new ReservationError('Review the active inquiries before closing them.');
    const operationRef = db.doc(`cateringBulkClosures/${body.operationId}`);
    const result = await db.runTransaction(async tx => {
      const operation = (await tx.get(operationRef)).data();
      if (!operation || operation.owner !== owner) throw new ReservationError('This review is unavailable. Review the inquiries again.', 409);
      const items = operation.items as BulkCloseItem[];
      if (operation.state === 'closed') return { closedCount: items.length, ids: items.map(item => item.id), repeated: true };
      if (operation.state !== 'review' || operation.expiresAt <= Date.now()) throw new ReservationError('This review expired. Review the inquiries again before closing them.', 409);
      if (!Array.isArray(items) || !items.length || items.length > bulkCloseLimit || new Set(items.map(item => item.id)).size !== items.length || items.some(item => !/^[A-Za-z0-9_-]{1,128}$/.test(item.id))) throw new ReservationError('This review needs to be refreshed.', 409);
      const settings = await tx.get(db.doc('settings/general')), timezone = businessTimezone(settings.data());
      const refs = items.flatMap(item => [db.doc(`catering/${item.id}`), db.doc(`cateringStaff/${item.id}`)]);
      const snapshots = await tx.getAll(...refs);
      // Validate every reviewed record before writing any changes. New arrivals are outside this snapshot.
      const leads = items.map((item, index) => {
        const record = snapshots[index * 2], staffRecord = snapshots[index * 2 + 1];
        if (!record.exists || cateringStamp(record.updateTime) !== item.recordStamp || cateringStamp(staffRecord.updateTime) !== item.staffStamp) throw new ReservationError('Some inquiries changed after your review. Nothing was closed. Review the updated inquiries and try again.', 409);
        const lead = cateringLead(item.id, cateringRecord(record.data()!, staffRecord.data()), timezone);
        if (lead.version !== item.version || lead.status !== item.status) throw new ReservationError('Some inquiries changed after your review. Nothing was closed. Review the updated inquiries and try again.', 409);
        return lead;
      });
      const timestamp = new Date();
      leads.forEach((lead, index) => {
        const version = lead.version + 1;
        tx.set(refs[index * 2 + 1], { workflowStage: 'completed', internalNotes: lead.internalNotes, followUpDate: '', version, updatedAt: timestamp }, { merge: true });
        tx.update(refs[index * 2], { status: 'completed', version, updatedAt: timestamp });
        tx.create(refs[index * 2].collection('events').doc(randomUUID()), { event: 'catering.updated', actor: 'staff', timestamp, previousStatus: lead.status, status: 'completed', notesChanged: false, followUpChanged: Boolean(lead.followUpDate), followUpDate: '', bulkOperationId: body.operationId });
      });
      tx.update(operationRef, { state: 'closed', closedAt: timestamp });
      return { closedCount: items.length, ids: items.map(item => item.id), repeated: false };
    });
    return privateJson({ success: true, ...result });
  } catch (error) { return reservationError(error); }
}
