import { createHash, randomUUID } from 'node:crypto';
import { getServerDatabase } from '@/lib/serverFirebase';
import { validMutationOrigin, readCookie } from '@/lib/auth/admin';
import { verifySignedToken } from '@/lib/auth/signedToken';
import { rateLimit } from '@/lib/auth/rateLimit';
import { cateringInput } from '@/lib/catering/input';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { scheduleDelivery } from '@/lib/reservations/background';
export async function POST(request: Request) {
  try {
    if (!validMutationOrigin(request)) throw new ReservationError('Invalid request origin', 403);
    let inquiry; try { inquiry = cateringInput((await request.json()).formData); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid inquiry'); }
    const proof = await verifySignedToken(readCookie(request, 'phone-verification'), 'phone');
    if (proof?.data.phone !== inquiry.phone) throw new ReservationError('Verify your phone number before submitting your catering inquiry.', 403);
    for (const [scope, identity, limit] of [['catering-email', inquiry.email.toLowerCase(), 3], ['catering-total', 'site', 100]] as const) {
      const limited = await rateLimit(scope, identity, limit, 600); if (limited) return limited;
    }
    const db = getServerDatabase(), ref = db.collection('catering').doc(), eventId = randomUUID();
    const key = request.headers.get('Idempotency-Key') || randomUUID();
    if (!/^[a-f0-9-]{36}$/i.test(key)) throw new ReservationError('A valid submission key is required');
    const fingerprint = createHash('sha256').update(JSON.stringify(inquiry)).digest('hex');
    const submission = db.doc(`bookingSubmissions/catering-${key}`);
    const cateringId = await db.runTransaction(async tx => {
      const existing = (await tx.get(submission)).data();
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new ReservationError('This submission key was already used for different details', 409);
        return existing.entityId as string;
      }
      tx.create(ref, { ...inquiry, phoneVerified: true, phoneVerificationSource: 'server', phoneVerifiedAt: new Date(), createdAt: new Date(), status: 'pending', ...(process.env.TABLEGO_ENVIRONMENT === 'staging' ? { isTest: true } : {}) });
      tx.create(ref.collection('events').doc(eventId), { event: 'catering.created', actor: 'guest', timestamp: new Date() });
      tx.create(submission, { entityId: ref.id, fingerprint, createdAt: new Date() });
      for (const recipient of ['guest', 'restaurant']) tx.create(db.doc(`notificationOutbox/${eventId}-${recipient}`), {
        kind: 'catering', entityId: ref.id, inquiry, recipient, channel: 'email', event: 'created', state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date(),
      });
      return ref.id;
    });
    scheduleDelivery(eventId);
    return privateJson({ success: true, cateringId, notificationStatus: 'queued' });
  } catch (error) { return reservationError(error); }
}
