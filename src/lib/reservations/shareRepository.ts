import { createHash, randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { reservationId } from './repository';
import { tokenHash } from './managementToken';
import { businessTimezone } from './policy';
import { scheduleDelivery } from './background';
import { ReservationError } from './http';
import { invitationDetails, invitationEmail, invitationQuota } from './sharing';

export async function shareReservation(id: string, token: unknown, input: unknown, key: unknown) {
  reservationId(id);
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new ReservationError('Invalid invitation submission key');
  let email: string;
  try { email = invitationEmail(input); } catch (error) { throw new ReservationError((error as Error).message); }
  const hash = tokenHash(token);
  if (!hash) throw new ReservationError('Use your secure reservation link to share this booking', 403);
  const db = getServerDatabase(), ref = db.doc(`reservations/${id}`), accessRef = db.doc(`managementAccess/${id}`);
  const fingerprint = createHash('sha256').update(email).digest('hex');
  // Existing rules keep the entire managementAccess tree server-only.
  const submission = accessRef.collection('shares').doc(createHash('sha256').update(key).digest('hex'));
  const eventId = randomUUID();
  const result = await db.runTransaction(async tx => {
    const [reservation, access, general, previous] = await Promise.all([
      tx.get(ref), tx.get(accessRef), tx.get(db.doc('settings/general')), tx.get(submission),
    ]);
    if (!reservation.exists || access.data()?.hash !== hash || typeof access.data()?.expiresAt !== 'number' || access.data()!.expiresAt <= Date.now()) throw new ReservationError('Invalid or expired reservation link', 403);
    let details, quota;
    try { details = invitationDetails(reservation.data()!, businessTimezone(general.data())); }
    catch (error) { throw new ReservationError((error as Error).message, 409); }
    if (previous.exists) {
      if (previous.data()!.fingerprint !== fingerprint) throw new ReservationError('This invitation submission belongs to a different email', 409);
      if (previous.data()!.notificationRevision !== (reservation.data()!.notificationRevision || 1)) throw new ReservationError('Your booking changed after this invitation. Reload the reservation before sharing again.', 409);
      return { eventId: previous.data()!.eventId as string, repeated: true };
    }
    try { quota = invitationQuota(reservation.data()!, fingerprint, Date.now()); }
    catch (error) { throw new ReservationError((error as Error).message, 429); }
    tx.update(ref, quota);
    tx.create(submission, { fingerprint, eventId, notificationRevision: reservation.data()!.notificationRevision || 1, createdAt: new Date() });
    tx.create(db.doc(`notificationOutbox/${eventId}-guest`), {
      kind: 'reservation-share', reservationId: id, event: 'shared', recipient: 'invitee', recipientEmail: email,
      channel: 'email', reservation: details, notificationRevision: reservation.data()!.notificationRevision || 1,
      state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date(),
    });
    tx.create(ref.collection('events').doc(eventId), { event: 'reservation.invitation_queued', actor: 'guest', recipient: 'invitee', timestamp: new Date(), correlationId: eventId });
    return { eventId, repeated: false };
  });
  scheduleDelivery(result.eventId);
  return { success: true, queued: true, repeated: result.repeated };
}
