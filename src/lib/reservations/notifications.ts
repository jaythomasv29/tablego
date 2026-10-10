import { createEmailTransport } from '../notificationTransport';
import { getServerDatabase } from '../serverFirebase';
import { decryptToken, managementUrl } from './managementToken';
import { randomUUID } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { statusLabels, type BookingState } from './domain';
import type { BookingInput } from './input';
import { sendSMS } from '../twilio';

const transport = createEmailTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 587), secure: false,
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
export type ReservationEvent = 'created' | 'confirmed' | 'rescheduled' | 'cancelled' | 'reminder' | 'recovered' | 'seated' | 'completed' | 'no-show';
export function notificationIntent(tx: Transaction, id: string, eventId: string, event: ReservationEvent,
  reservation: BookingInput & { status: BookingState }, encryptedToken: string, channel: 'email' | 'sms' = 'email') {
  for (const recipient of ['guest', 'restaurant'] as const) {
    if (recipient === 'restaurant' && (event === 'reminder' || event === 'recovered')) continue;
    if (recipient === 'guest' && ['seated', 'completed', 'no-show'].includes(event)) continue;
    tx.create(getServerDatabase().doc(`notificationOutbox/${eventId}-${recipient}`), {
      reservationId: id, event, recipient, channel, reservation, encryptedToken, state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date(),
    });
  }
}
export function renderNotification(job: { event: ReservationEvent; recipient: string; reservationId: string; encryptedToken: string; reservation: BookingInput & { status: BookingState } }) {
  const reservation = job.reservation;
  const titles: Record<ReservationEvent, string> = { created: 'Reservation request received', confirmed: 'Reservation accepted', rescheduled: 'Reservation change requested',
    cancelled: 'Reservation cancelled', reminder: 'Upcoming reservation reminder', recovered: 'Your secure reservation link', seated: 'Guest seated', completed: 'Visit completed', 'no-show': 'Reservation marked no-show' };
  const url = managementUrl(job.reservationId, decryptToken(job.encryptedToken));
  const date = new Date(`${reservation.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const text = `${titles[job.event]}. ${reservation.name}: ${date} at ${reservation.time}, ${reservation.guests} guests. Status: ${statusLabels[reservation.status]}. ${reservation.status === 'pending' ? 'The restaurant still needs to accept this request. ' : ''}Manage reservation: ${url}`;
  return { from: process.env.EMAIL_USER, to: job.recipient === 'guest' ? reservation.email : process.env.EMAIL_USER,
    subject: `${titles[job.event]} — Thaiphoon Restaurant`, text,
    html: `<main style="max-width:600px;margin:32px auto;padding:32px;font-family:Arial,sans-serif;color:#121212;background:#f9f7f2;border-radius:16px"><p>Thaiphoon · Palo Alto</p><h1>${escapeHtml(titles[job.event])}</h1><p>Hello ${escapeHtml(reservation.name)},</p><p>${escapeHtml(date)} at ${escapeHtml(reservation.time)} · ${reservation.guests} guests</p><p><strong>${escapeHtml(statusLabels[reservation.status])}</strong></p>${reservation.status === 'pending' ? '<p>The restaurant still needs to accept this request. Guest acknowledgement does not confirm a table.</p>' : ''}<p>${escapeHtml(reservation.comments)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;background:#121212;color:#fff;border-radius:8px">Manage reservation</a></p></main>` };
}
// Durable intents are committed with the booking. A failed send never reverses it.
export async function deliverNotification(id: string): Promise<'delivered' | 'failed' | 'skipped'> {
  const db = getServerDatabase(), ref = db.doc(`notificationOutbox/${id}`), lease = randomUUID();
  const job = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || record.state === 'delivered' || record.attempts >= 5 || record.nextAttemptAt.toMillis() > Date.now() ||
      (record.state === 'sending' && record.leaseUntil?.toMillis() > Date.now())) return null;
    tx.update(ref, { state: 'sending', lease, leaseUntil: new Date(Date.now() + 120_000), attempts: record.attempts + 1 });
    return record;
  });
  if (!job) return 'skipped';
  let state: 'delivered' | 'failed' = 'failed';
  try {
    const message = renderNotification(job as Parameters<typeof renderNotification>[0]);
    if (job.channel === 'sms') await sendSMS({ to: job.reservation.phone, body: message.text });
    else {
      const result = await transport.sendMail(message);
      if ('rejected' in result && result.rejected?.length) throw new Error('Recipient rejected');
    }
    state = 'delivered';
  } catch { /* Provider errors may contain credentials or guest data; record a safe category only. */ }
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (current?.lease !== lease) return;
    tx.update(ref, { state, lastAttemptAt: new Date(), nextAttemptAt: new Date(Date.now() + Math.min(3600, 60 * 2 ** current.attempts) * 1000),
      lastError: state === 'failed' ? 'provider-delivery-failed' : null, leaseUntil: null });
    tx.create(db.doc(`reservations/${job.reservationId}/events/${randomUUID()}`), {
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
