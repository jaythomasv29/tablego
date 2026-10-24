import { marketingSnapshot } from '../marketing/repository';
import { renderMarketingNotification, renderMarketingTestNotification } from '../marketing/render';
import { renderNotification } from './render';
export { renderNotification } from './render';
import { renderCateringNotification } from '../catering/notification';
import { renderMailingConfirmation } from '../mailing/render';
import { renderReservationInvitation } from './shareRender';
import { renderFeedbackNotification } from './feedbackRender';
import { invitationDetails } from './sharing';
import { restaurantIdentity } from '../restaurant/config';
import { createEmailTransport } from '../notificationTransport';
import { getServerDatabase } from '../serverFirebase';
import { randomUUID, createHash } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { bookingState, type BookingState } from './domain';
import type { BookingInput } from './input';
import { sendSMS } from '../twilio';

const transport = createEmailTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465, requireTLS: Number(process.env.SMTP_PORT || 587) !== 465,
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
export { escapeHtml } from '../formatting/html';
export type ReservationEvent = 'created' | 'confirmed' | 'rescheduled' | 'updated' | 'cancelled' | 'reminder' | 'recovered' | 'seated' | 'completed' | 'no-show';
export function notificationIntent(tx: Transaction, id: string, eventId: string, event: ReservationEvent,
  reservation: BookingInput & { status: BookingState; notificationRevision?: number; restaurantTimezone?: string; providerTestRunId?: string }, encryptedToken: string, channel: 'email' | 'sms' = 'email') {
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
    if (record.kind === 'marketing-test') {
      tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
      return record;
    }
    if (record.kind === 'mailing-confirmation') {
      const contact = (await tx.get(db.doc(`mailingContacts/${record.entityId}`))).data();
      const access = (await tx.get(db.doc(`mailingAccess/${record.entityId}`))).data();
      if (!contact || !access || contact.status === 'subscribed' || contact.version !== record.version || access.confirmationVersion !== record.version || access.confirmationExpiresAt <= Date.now()) {
        tx.update(ref, { state: 'superseded', lastError: 'signup-changed-or-expired' }); return null;
      }
      tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
      return { ...record, email: contact.email, encryptedConfirmation: access.encryptedConfirmation, encryptedUnsubscribe: access.encryptedUnsubscribe } as FirebaseFirestore.DocumentData;
    }
    if (record.kind === 'marketing') {
      const snapshot = await marketingSnapshot(tx);
      const campaign = (await tx.get(db.doc(`marketingCampaigns/${record.campaignId}`))).data();
      if (!campaign || campaign.state !== 'queued' || !snapshot.candidates.some(candidate => candidate.id === record.campaignId)) {
        tx.update(ref, { state: 'superseded', lastError: 'customer-returned-or-unsubscribed' });
        if (campaign?.state === 'queued') tx.update(db.doc(`marketingCampaigns/${record.campaignId}`), { state: 'superseded' });
        return null;
      }
      tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
      return record;
    }
    if (record.kind === 'catering') {
      if (!(await tx.get(db.doc(`catering/${record.entityId}`))).exists) { tx.update(ref, { state: 'superseded', lastError: 'inquiry-missing' }); return null; }
      tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
      return record;
    }
    const current = (await tx.get(db.doc(`reservations/${record.reservationId}`))).data();
    if (['follow-up', 'feedback-received'].includes(record.kind)) {
      let encryptedToken = record.encryptedToken;
      if (!current) { tx.update(ref, { state: 'superseded', lastError: 'reservation-missing' }); return null; }
      if (record.kind === 'follow-up') {
        const feedbackAccess = (await tx.get(db.doc('managementAccess/' + record.reservationId + '/feedback/access'))).data();
        const emailHash = createHash('sha256').update(String(current.email || '').trim().toLowerCase()).digest('hex');
        const preference = (await tx.get(db.doc('managementAccess/_feedback_preferences/preferences/' + emailHash))).data();
        if (bookingState(current) !== 'completed' || current.feedbackSubmissionHash || current.feedbackRespondedAt || current.privateFeedbackAt || current.privateFeedback || preference?.stopped === true ||
          record.notificationRevision !== (current.notificationRevision || 1) || !feedbackAccess || feedbackAccess.expiresAt <= Date.now()) {
          tx.update(ref, { state: 'superseded', lastError: 'feedback-not-eligible' }); return null;
        }
        encryptedToken = feedbackAccess.encryptedToken;
      }
      tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
      return { ...record, encryptedToken } as FirebaseFirestore.DocumentData;
    }
    const access = (await tx.get(db.doc(`managementAccess/${record.reservationId}`))).data();
    if (!current || (record.notificationRevision && record.notificationRevision !== (current.notificationRevision || 1)) ||
      (record.kind === 'reservation-share' && current.status !== 'confirmed') ||
      (record.channel === 'sms' && (current.smsOptIn !== true || current.phoneVerificationSource !== 'server'))) {
      tx.update(ref, { state: 'superseded', lastError: 'reservation-changed-or-consent-revoked' });
      return null;
    }
    if (record.kind === 'reservation-share') {
      try { invitationDetails(current, record.reservation.restaurantTimezone); }
      catch { tx.update(ref, { state: 'superseded', lastError: 'reservation-no-longer-shareable' }); return null; }
    }
    if (record.kind !== 'reservation-share' && (!access || access.expiresAt <= Date.now())) { tx.update(ref, { state: 'exhausted', lastError: 'management-link-expired' }); return null; }
    tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), nextAttemptAt: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
    return { ...record, ...(record.kind !== 'reservation-share' ? { encryptedToken: access!.encryptedToken } : {}) } as FirebaseFirestore.DocumentData;
  });
  if (!job) return 'skipped';
  let state: 'delivered' | 'failed' = 'failed';
  let deliveryMode: 'capture' | 'provider' | null = null;
  let providerMessageId: string | null = null;
  try {
    const configuration = (await db.doc('settings/general').get()).data();
    const identity = restaurantIdentity(configuration?.restaurant);
    const message = job.kind === 'marketing-test' ? renderMarketingTestNotification(job as Parameters<typeof renderMarketingTestNotification>[0])
      : job.kind === 'marketing' ? renderMarketingNotification(job as Parameters<typeof renderMarketingNotification>[0])
      : job.kind === 'mailing-confirmation' ? renderMailingConfirmation(job as Parameters<typeof renderMailingConfirmation>[0], identity)
      : ['follow-up', 'feedback-received'].includes(job.kind) ? renderFeedbackNotification(job as Parameters<typeof renderFeedbackNotification>[0], identity)
      : job.kind === 'reservation-share' ? renderReservationInvitation(job as Parameters<typeof renderReservationInvitation>[0], identity)
      : job.kind === 'catering' ? renderCateringNotification(job as Parameters<typeof renderCateringNotification>[0], identity)
      : renderNotification({ ...job, restaurant: identity } as Parameters<typeof renderNotification>[0]);
    if (job.channel === 'sms') {
      const result = await sendSMS({ to: job.reservation.phone, body: message.text });
      deliveryMode = 'captured' in result && result.captured ? 'capture' : 'provider'; providerMessageId = result.sid;
    }
    else {
      const host = new URL(process.env.NEXT_PUBLIC_BASE_URL!).hostname;
      const result = await transport.sendMail({ ...message, messageId: `<tablego-${id}@${host}>` });
      deliveryMode = 'captured' in result && result.captured ? 'capture' : 'provider'; providerMessageId = result.messageId;
      if ('rejected' in result && result.rejected?.length) throw new Error('Recipient rejected');
    }
    state = 'delivered';
  } catch { /* Provider errors may contain credentials or guest data; record a safe category only. */ }
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.lease !== lease) return;
    tx.update(ref, { state: state === 'failed' && current.attempts >= 5 ? 'exhausted' : state, lastAttemptAt: new Date(), nextAttemptAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** current.attempts) * 1000),
      deliveryMode, providerMessageId, lastError: state === 'failed' ? 'provider-delivery-failed' : null, leaseUntil: null });
    if (job.kind === 'marketing-test') return;
    if (job.kind === 'marketing') {
      tx.update(db.doc(`marketingCampaigns/${job.campaignId}`), { state: state === 'failed' && current.attempts >= 5 ? 'exhausted' : state === 'failed' ? 'queued' : 'delivered', lastAttemptAt: new Date().toISOString(), deliveryMode, attempts: current.attempts });
      return;
    }
    tx.create(db.doc(`${job.kind === 'mailing-confirmation' ? `mailingContacts/${job.entityId}` : job.kind === 'catering' ? `catering/${job.entityId}` : `reservations/${job.reservationId}`}/events/${randomUUID()}`), {
      event: `notification.${state}`, actor: 'system', channel: job.channel || 'email', recipient: job.recipient, notificationId: id, timestamp: new Date(),
    });
    if (state === 'delivered' && job.kind === 'follow-up') tx.update(db.doc('reservations/' + job.reservationId), { followUpSent: true, followUpSentAt: new Date() });
    if (state === 'delivered' && job.event === 'reminder') tx.update(db.doc(`reservations/${job.reservationId}`),
      job.channel === 'sms' ? { smsSent: true, smsSentAt: new Date() } : { reminderSent: true, reminderSentAt: new Date() });
  });
  return state;
}
export async function deliverEvent(eventId: string) {
  // Best effort immediate delivery; the persistent worker can recover any intent.
  return Promise.allSettled(['guest', 'restaurant'].map(recipient => deliverNotification(`${eventId}-${recipient}`)));
}
