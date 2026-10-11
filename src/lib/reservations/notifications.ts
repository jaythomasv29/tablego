import { renderNotification } from './render';
export { renderNotification } from './render';
import { renderCateringNotification } from '../catering/notification';
import { restaurantIdentity } from '../restaurant/config';
import { createEmailTransport } from '../notificationTransport';
import { getServerDatabase } from '../serverFirebase';
import { randomUUID } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { type BookingState } from './domain';
import type { BookingInput } from './input';
import { sendSMS } from '../twilio';

const transport = createEmailTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 587), secure: false,
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
export { escapeHtml } from '../formatting/html';
export type ReservationEvent = 'created' | 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder' | 'recovered' | 'seated' | 'completed' | 'no-show';
export function notificationIntent(tx: Transaction, id: string, eventId: string, event: ReservationEvent,
  reservation: BookingInput & { status: BookingState; notificationRevision?: number; restaurantTimezone?: string }, encryptedToken: string, channel: 'email' | 'sms' = 'email') {
  for (const recipient of ['guest', 'restaurant'] as const) {
    if (recipient === 'restaurant' && (event === 'reminder' || event === 'recovered')) continue;
    if (recipient === 'guest' && ['seated', 'completed', 'no-show'].includes(event)) continue;
    tx.create(getServerDatabase().doc(`notificationOutbox/${eventId}-${recipient}`), {
      reservationId: id, event, recipient, channel, reservation, encryptedToken, notificationRevision: reservation.notificationRevision || 1,
      state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date(),
    });
  }
}
// Durable intents are committed with the booking. A failed send never reverses it.
export async function deliverNotification(id: string): Promise<'delivered' | 'failed' | 'skipped'> {
  const db = getServerDatabase(), ref = db.doc(`notificationOutbox/${id}`), lease = randomUUID();
  const job = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || !['queued', 'failed', 'sending'].includes(record.state) || record.nextAttemptAt.toMillis() > Date.now() ||
      (record.state === 'sending' && record.leaseUntil?.toMillis() > Date.now())) return null;
    if (record.attempts >= 5) { tx.update(ref, { state: 'exhausted', lastError: 'attempt-limit-reached' }); return null; }
    if (record.kind === 'catering') {
      if (!(await tx.get(db.doc(`catering/${record.entityId}`))).exists) { tx.update(ref, { state: 'superseded', lastError: 'inquiry-missing' }); return null; }
      tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
      return record;
    }
    const current = (await tx.get(db.doc(`reservations/${record.reservationId}`))).data();
    const access = (await tx.get(db.doc(`managementAccess/${record.reservationId}`))).data();
    if (!current || (record.notificationRevision && record.notificationRevision !== (current.notificationRevision || 1)) ||
      (record.channel === 'sms' && (current.smsOptIn !== true || current.phoneVerificationSource !== 'server'))) {
      tx.update(ref, { state: 'superseded', lastError: 'reservation-changed-or-consent-revoked' });
      return null;
    }
    if (!access || access.expiresAt <= Date.now()) { tx.update(ref, { state: 'exhausted', lastError: 'management-link-expired' }); return null; }
    tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
    return { ...record, encryptedToken: access.encryptedToken } as FirebaseFirestore.DocumentData;
  });
  if (!job) return 'skipped';
  let state: 'delivered' | 'failed' = 'failed';
  try {
    const configuration = (await db.doc('settings/general').get()).data();
    const identity = restaurantIdentity(configuration?.restaurant);
    const message = job.kind === 'catering' ? renderCateringNotification(job as Parameters<typeof renderCateringNotification>[0], identity)
      : renderNotification({ ...job, restaurant: identity } as Parameters<typeof renderNotification>[0]);
    if (job.channel === 'sms') await sendSMS({ to: job.reservation.phone, body: message.text });
    else {
      const host = new URL(process.env.NEXT_PUBLIC_BASE_URL!).hostname;
      const result = await transport.sendMail({ ...message, messageId: `<tablego-${id}@${host}>` });
      if ('rejected' in result && result.rejected?.length) throw new Error('Recipient rejected');
    }
    state = 'delivered';
  } catch { /* Provider errors may contain credentials or guest data; record a safe category only. */ }
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.lease !== lease) return;
    tx.update(ref, { state: state === 'failed' && current.attempts >= 5 ? 'exhausted' : state, lastAttemptAt: new Date(), nextAttemptAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** current.attempts) * 1000),
      lastError: state === 'failed' ? 'provider-delivery-failed' : null, leaseUntil: null });
    tx.create(db.doc(`${job.kind === 'catering' ? `catering/${job.entityId}` : `reservations/${job.reservationId}`}/events/${randomUUID()}`), {
      event: `notification.${state}`, actor: 'system', channel: job.channel || 'email', recipient: job.recipient, notificationId: id, timestamp: new Date(),
    });
    if (state === 'delivered' && job.event === 'reminder') tx.update(db.doc(`reservations/${job.reservationId}`),
      job.channel === 'sms' ? { smsSent: true, smsSentAt: new Date() } : { reminderSent: true, reminderSentAt: new Date() });
  });
  return state;
}
export async function deliverEvent(eventId: string) {
  // Best effort immediate delivery; the persistent worker can recover any intent.
  return Promise.allSettled(['guest', 'restaurant'].map(recipient => deliverNotification(`${eventId}-${recipient}`)));
}
