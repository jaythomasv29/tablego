import { createHash, randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { bookingState } from './domain';
import { reservationId } from './repository';
import { tokenHash, newManagementToken, encryptToken } from './managementToken';
import { feedbackInput, feedbackSettings, followUpEligibility } from './feedbackPolicy';
import { businessTimezone } from './policy';
import { getLocalDateString } from '../../utils/dateUtils';
import { ReservationError } from './http';
import { scheduleDelivery } from './background';

export const feedbackPreferenceId = (email: string) => createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
export function feedbackUrl(id: string, token: string) {
  return new URL('/feedback/' + encodeURIComponent(id), process.env.NEXT_PUBLIC_BASE_URL).toString() + '#token=' + token;
}
export async function queueFollowUp(id: string) {
  reservationId(id);
  const db = getServerDatabase(), ref = db.doc('reservations/' + id), eventId = randomUUID();
  const result = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data(), general = (await tx.get(db.doc('settings/general'))).data();
    if (!record) throw new ReservationError('Reservation not found', 404);
    const preference = await tx.get(db.doc('managementAccess/_feedback_preferences/preferences/' + feedbackPreferenceId(String(record.email || ''))));
    if (preference.data()?.stopped === true) throw new ReservationError('Guest has opted out of visit follow-ups', 409);
    // One durable intent per visit, including while a provider is unavailable.
    if (record.followUpEventId) return { eventId: String(record.followUpEventId), repeated: true };
    const timezone = businessTimezone(general);
    const eligible = followUpEligibility(record, timezone, feedbackSettings(general).followUpDelayMinutes);
    if (!eligible.eligible) throw new ReservationError(eligible.reason, 409);
    const token = newManagementToken(), encryptedToken = encryptToken(token);
    tx.set(db.doc('managementAccess/' + id + '/feedback/access'), { hash: tokenHash(token), encryptedToken, expiresAt: Date.now() + 31 * 86400000 });
    tx.update(ref, { followUpEventId: eventId, followUpQueuedAt: new Date() });
    tx.create(db.doc('notificationOutbox/' + eventId + '-guest'), {
      kind: 'follow-up', reservationId: id, event: 'follow-up', recipient: 'guest', channel: 'email',
      reservation: { name: record.name, email: record.email, date: getLocalDateString(record.date, timezone), time: record.time, guests: record.guests, restaurantTimezone: timezone },
      encryptedToken, notificationRevision: record.notificationRevision || 1,
      state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date(),
    });
    tx.create(ref.collection('events').doc(eventId), { event: 'reservation.follow_up_queued', actor: 'staff', timestamp: new Date(), correlationId: eventId });
    return { eventId, repeated: false };
  });
  scheduleDelivery(result.eventId);
  return { success: true, queued: true, repeated: result.repeated };
}
export async function readFeedback(id: string, token: unknown) {
  reservationId(id);
  const db = getServerDatabase(), hash = tokenHash(token);
  const [record, access, general] = await Promise.all([db.doc('reservations/' + id).get(), db.doc('managementAccess/' + id + '/feedback/access').get(), db.doc('settings/general').get()]);
  if (!hash || !record.exists || access.data()?.hash !== hash || access.data()!.expiresAt <= Date.now()) throw new ReservationError('Use your secure feedback email link. Older links can be recovered by verifying the booking phone.', 403);
  const data = record.data()!, timezone = businessTimezone(general.data());
  const preference = await db.doc('managementAccess/_feedback_preferences/preferences/' + feedbackPreferenceId(String(data.email || ''))).get();
  return { name: data.name, date: getLocalDateString(data.date, timezone), time: data.time, guests: data.guests, timezone,
    submitted: Boolean(data.feedbackSubmissionHash || data.feedbackRespondedAt || data.privateFeedbackAt || data.privateFeedback), stopped: preference.data()?.stopped === true, reviewUrl: feedbackSettings(general.data()).reviewUrl };
}
export async function submitFeedback(id: string, token: unknown, input: unknown) {
  reservationId(id);
  const db = getServerDatabase(), ref = db.doc('reservations/' + id), hash = tokenHash(token), eventId = randomUUID();
  const unsubscribe = input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 1 && (input as { action?: string }).action === 'unsubscribe';
  let feedback: ReturnType<typeof feedbackInput> | null = null;
  if (!unsubscribe) { try { feedback = feedbackInput(input); } catch (error) { throw new ReservationError((error as Error).message); } }
  const fingerprint = createHash('sha256').update(JSON.stringify(feedback)).digest('hex');
  const result = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data(), access = (await tx.get(db.doc('managementAccess/' + id + '/feedback/access'))).data();
    if (!hash || !record || access?.hash !== hash || access.expiresAt <= Date.now()) throw new ReservationError('Invalid or expired feedback link', 403);
    const preferenceRef = db.doc('managementAccess/_feedback_preferences/preferences/' + feedbackPreferenceId(String(record.email || '')));
    if (unsubscribe || feedback?.stopFollowUps) tx.set(preferenceRef, { stopped: true, updatedAt: new Date() });
    if (unsubscribe) return { repeated: false, notify: false };
    if (record.feedbackSubmissionHash) {
      if (record.feedbackSubmissionHash !== fingerprint) throw new ReservationError('Feedback has already been submitted for this visit', 409);
      return { repeated: true, notify: false };
    }
    if (record.privateFeedback || record.feedbackRespondedAt || record.privateFeedbackAt) throw new ReservationError('Feedback has already been submitted for this visit', 409);
    // Guest feedback never changes staff attendance or the reservation lifecycle.
    tx.update(ref, { feedbackSubmissionHash: fingerprint, feedbackSentiment: feedback!.sentiment, privateFeedback: feedback!.comment, feedbackReceivedAt: new Date() });
    tx.create(ref.collection('events').doc(eventId), { event: 'reservation.feedback_received', actor: 'guest', timestamp: new Date(), sentiment: feedback!.sentiment });
    tx.create(db.doc('notificationOutbox/' + eventId + '-restaurant'), { kind: 'feedback-received', reservationId: id, event: 'feedback-received', recipient: 'restaurant', channel: 'email',
      reservation: { name: record.name }, feedback, state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date() });
    return { repeated: false, notify: true };
  });
  if (result.notify) scheduleDelivery(eventId);
  return { success: true, repeated: result.repeated };
}
export async function recoverFeedback(id: string, phone: string) {
  reservationId(id);
  const db = getServerDatabase(), token = newManagementToken();
  const digits = (value: string) => value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  await db.runTransaction(async tx => {
    const ref = db.doc('reservations/' + id), record = (await tx.get(ref)).data();
    if (!record || typeof record.phone !== 'string' || digits(record.phone) !== digits(phone) ||
      (bookingState(record) !== 'completed' && record.followUpSent !== true && !record.followUpEventId)) throw new ReservationError('Unable to recover feedback access for this booking', 403);
    tx.set(db.doc('managementAccess/' + id + '/feedback/access'), { hash: tokenHash(token), encryptedToken: encryptToken(token), expiresAt: Date.now() + 31 * 86400000 });
    tx.create(ref.collection('events').doc(randomUUID()), { event: 'reservation.feedback_access_recovered', actor: 'verified-guest', timestamp: new Date() });
  });
  return { success: true, feedbackUrl: feedbackUrl(id, token) };
}
