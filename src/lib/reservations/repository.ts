import { capturesNotifications } from '../notificationTransport';
import { smsReminderCapability } from './communications';
import { providerTestTag } from '../providerTest';
import { createHash, randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { automaticConfirmation, bookingState, isGuestEditable, transition, type StaffAction } from './domain';
import { checkAvailability, validDate, timeMinutes, displayTime } from './availability';
import { loadPolicy, businessTimezone } from './policy';
import { newManagementToken, tokenHash, encryptToken, decryptToken, managementUrl } from './managementToken';
import { notificationIntent, type ReservationEvent } from './notifications';
import { getLocalDateString } from '../../utils/dateUtils';
import { arrivalDue } from './service';
import { scheduleDelivery } from './background';
import { ReservationError } from './http';
import type { BookingInput } from './input';

export function reservationId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new ReservationError('Invalid reservation link', 403);
  return value;
}
function publicReservation(id: string, record: FirebaseFirestore.DocumentData, timezone: string, autoConfirmReservations = true) {
  return { autoConfirmReservations, id, name: record.name, date: dateString(record.date, timezone), time: record.time, guests: record.guests,
    status: bookingState(record), guestAcknowledged: Boolean(record.guestAcknowledgedAt), comments: record.comments || '', timezone, version: record.version || 1 };
}
function dateString(value: unknown, timezone: string): string {
  try { return getLocalDateString(value, timezone); }
  catch { throw new ReservationError('Reservation date needs staff review', 409); }
}
function notificationRecord(record: FirebaseFirestore.DocumentData, timezone: string): BookingInput & { status: ReturnType<typeof bookingState>; notificationRevision: number; restaurantTimezone: string; providerTestRunId?: string } {
  return { name: record.name, email: record.email, phone: record.phone || '', date: dateString(record.date, timezone), time: record.time,
    guests: record.guests, comments: record.comments || '', status: bookingState(record), notificationRevision: record.notificationRevision || 1, restaurantTimezone: timezone, ...(typeof record.providerTestRunId === 'string' ? { providerTestRunId: record.providerTestRunId } : {}) };
}
export async function createReservation(input: BookingInput, phoneVerified: boolean, smsOptIn: boolean, key: string) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new ReservationError('Invalid submission key');
  const db = getServerDatabase(), ref = db.collection('reservations').doc(), eventId = randomUUID();
  const submission = db.doc(`bookingSubmissions/${createHash('sha256').update(key).digest('hex')}`);
  const fingerprint = createHash('sha256').update(JSON.stringify({ input, smsOptIn })).digest('hex');
  if (new Date(`${input.date}T12:00:00Z`).getTime() > Date.now() + 366 * 86400000) throw new ReservationError('Please book within one year');
  const token = newManagementToken(), encryptedToken = encryptToken(token);
  const result = await db.runTransaction(async tx => {
    const existing = (await tx.get(submission)).data();
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new ReservationError('This submission key belongs to different reservation details', 409);
      const currentAccess = (await tx.get(db.doc(`managementAccess/${existing.reservationId}`))).data();
      const currentRecord = (await tx.get(db.doc(`reservations/${existing.reservationId}`))).data();
      if (!currentRecord) throw new ReservationError('The saved reservation needs staff review', 409);
      const timezone = currentRecord.restaurantTimezone || (await loadPolicy(tx)).timezone;
      return { details: { ...input, ...publicReservation(existing.reservationId, currentRecord, timezone) }, id: existing.reservationId as string, token: decryptToken(currentAccess?.encryptedToken || existing.encryptedToken), eventId: existing.eventId as string, timezone, repeated: true };
    }
    const policy = await loadPolicy(tx);
    if (!checkAvailability(input.date, input.time, policy).available) throw new ReservationError('This time is unavailable. Please choose another time.', 409);
    const status = policy.autoConfirmReservations === false ? 'pending' as const : 'confirmed' as const;
    const reservation = { ...input, ...providerTestTag(input), restaurantTimezone: policy.timezone, status, ...(status === 'confirmed' ? { confirmedAt: new Date(), confirmedBy: 'automatic' } : {}), phoneVerified, phoneVerificationSource: phoneVerified ? 'server' : 'unverified', smsOptIn, marked: false, createdAt: new Date(), schemaVersion: 2, version: 1, notificationRevision: 1, isTest: process.env.TABLEGO_ENVIRONMENT === 'staging' };
    tx.create(ref, reservation);
    tx.create(db.doc(`managementAccess/${ref.id}`), { hash: tokenHash(token), encryptedToken, expiresAt: new Date(`${input.date}T23:59:59Z`).getTime() + 31 * 86400000 });
    tx.create(submission, { fingerprint, reservationId: ref.id, encryptedToken, eventId, createdAt: new Date() });
    tx.create(ref.collection('events').doc(eventId), { event: 'reservation.created', actor: 'guest', status, timestamp: new Date(), correlationId: eventId });
    if (status === 'confirmed') tx.create(ref.collection('events').doc(randomUUID()), { event: 'reservation.auto_confirmed', actor: 'system', timestamp: new Date(), correlationId: eventId, status });
    notificationIntent(tx, ref.id, eventId, 'created', reservation, encryptedToken);
    return { details: { ...input, ...publicReservation(ref.id, reservation, policy.timezone) }, id: ref.id, token, eventId, timezone: policy.timezone, repeated: false };
  });
  scheduleDelivery(result.eventId);
  return { success: true, reservationId: result.id, managementUrl: managementUrl(result.id, result.token),
    reservationDetails: { ...result.details, reservationId: result.id }, notificationStatus: 'queued-or-delivered', repeated: result.repeated };
}
export async function readGuestReservation(id: string, token: unknown) {
  const db = getServerDatabase(), hash = tokenHash(token);
  if (!hash) throw new ReservationError('Use a valid secure reservation link or verify your phone to recover access.', 403);
  const [access, reservation] = await Promise.all([db.doc(`managementAccess/${reservationId(id)}`).get(), db.doc(`reservations/${id}`).get()]);
  if (!reservation.exists || access.data()?.hash !== hash || access.data()!.expiresAt <= Date.now()) throw new ReservationError('This link is invalid or expired. Verify your phone to recover access.', 403);
  const general = (await db.doc('settings/general').get()).data();
  const timezone = businessTimezone(general);
  return publicReservation(id, reservation.data()!, timezone, automaticConfirmation(general?.autoConfirmReservations));
}
export async function actOnReservation(id: string, action: string, actor: 'guest' | 'staff', token: unknown, change?: { date?: unknown; time?: unknown; version?: unknown }) {
  const db = getServerDatabase(), ref = db.doc(`reservations/${reservationId(id)}`), eventId = randomUUID();
  const result = await db.runTransaction(async tx => {
    const reservation = await tx.get(ref), access = await tx.get(db.doc(`managementAccess/${id}`));
    const data = reservation.data();
    if (!data) throw new ReservationError(actor === 'guest' ? 'Invalid or expired reservation link' : 'Reservation not found', actor === 'guest' ? 403 : 404);
    if (actor === 'guest' && (!tokenHash(token) || tokenHash(token) !== access.data()?.hash || access.data()!.expiresAt <= Date.now())) throw new ReservationError('Invalid or expired reservation link', 403);
    const general = (await tx.get(db.doc('settings/general'))).data();
    const timezone = businessTimezone(general), autoConfirmReservations = automaticConfirmation(general?.autoConfirmReservations);
    const state = bookingState(data), patch: FirebaseFirestore.DocumentData = {};
    let event: ReservationEvent | null = null;
    if (actor === 'guest' && !['acknowledge', 'cancel', 'reschedule'].includes(action)) throw new ReservationError('Action not permitted', 403);
    if (action === 'acknowledge') {
      if (!isGuestEditable(state)) throw new ReservationError('This reservation can no longer be acknowledged', 409);
      if (data.guestAcknowledgedAt) return { reservation: publicReservation(id, data, timezone, autoConfirmReservations), changed: false };
      patch.guestAcknowledgedAt = new Date();
    } else if (action === 'reschedule') {
      if (!isGuestEditable(state)) throw new ReservationError('This reservation can no longer be changed', 409);
      if (!validDate(change?.date) || timeMinutes(change?.time) === null) throw new ReservationError('Invalid date or time');
      const time = displayTime(timeMinutes(change!.time)!);
      if (data.date === change!.date && data.time === time) return { reservation: publicReservation(id, data, timezone, autoConfirmReservations), changed: false };
      if (new Date(`${change!.date}T12:00:00Z`).getTime() > Date.now() + 366 * 86400000) throw new ReservationError('Please book within one year');
      const policy = await loadPolicy(tx);
      if (!checkAvailability(change!.date as string, time, policy).available) throw new ReservationError('The new time is unavailable. Your existing reservation is unchanged.', 409);
      if (change?.version !== undefined && change.version !== (data.version || 1)) throw new ReservationError('Reservation changed. Reload before trying again.', 409);
      Object.assign(patch, { date: change!.date, time, status: policy.autoConfirmReservations === false ? 'pending' : 'confirmed', restaurantTimezone: policy.timezone, confirmedAt: policy.autoConfirmReservations === false ? null : new Date(), confirmedBy: policy.autoConfirmReservations === false ? null : 'automatic', guestAcknowledgedAt: null, rescheduledAt: new Date() });
      if (access.exists) tx.update(access.ref, { expiresAt: Math.max(access.data()!.expiresAt, new Date(`${change!.date}T23:59:59Z`).getTime() + 31 * 86400000) });
      event = 'rescheduled';
    } else {
      if (!['confirm', 'seat', 'complete', 'cancel', 'no-show'].includes(action)) throw new ReservationError('Unknown action');
      if (action === 'no-show' && state !== 'no-show' && !arrivalDue({ date: dateString(data.date, timezone), time: data.time }, timezone)) throw new ReservationError('No-show can only be recorded after the scheduled arrival time in the restaurant timezone.', 409);
      let next;
      try { next = transition(state, action as StaffAction); } catch (error) { throw new ReservationError((error as Error).message, 409); }
      if (state === next) return { reservation: publicReservation(id, data, timezone, autoConfirmReservations), changed: false };
      Object.assign(patch, { status: next, attendanceStatus: next === 'seated' || next === 'completed' ? 'show' : next === 'no-show' ? 'no-show' : null, [`${next.replace('-', '')}At`]: new Date() });
      event = next as ReservationEvent;
    }
    patch.version = (data.version || 1) + 1; patch.updatedAt = new Date();
    if (event) patch.notificationRevision = (data.notificationRevision || 1) + 1;
    tx.update(ref, patch);
    tx.create(ref.collection('events').doc(eventId), { event: `reservation.${event || 'acknowledged'}`, actor, timestamp: new Date(), correlationId: eventId,
      previousStatus: state, status: patch.status || state });
    const updated = { ...data, ...patch };
    if (event) {
      let encryptedToken = access.data()?.encryptedToken;
      if (!encryptedToken || access.data()!.expiresAt <= Date.now()) {
        const fresh = newManagementToken(); encryptedToken = encryptToken(fresh);
        tx.set(db.doc(`managementAccess/${id}`), { hash: tokenHash(fresh), encryptedToken, expiresAt: Date.now() + 365 * 86400000 });
      }
      notificationIntent(tx, id, eventId, event, notificationRecord(updated, timezone), encryptedToken);
    }
    return { reservation: publicReservation(id, updated, timezone, autoConfirmReservations), changed: true };
  });
  if (result.changed) scheduleDelivery(eventId);
  return { success: true, ...result };
}
export async function recoverReservation(id: string, verifiedPhone: string) {
  const db = getServerDatabase(), token = newManagementToken(), encryptedToken = encryptToken(token), eventId = randomUUID();
  await db.runTransaction(async tx => {
    const ref = db.doc(`reservations/${reservationId(id)}`), data = (await tx.get(ref)).data();
    const timezone = businessTimezone((await tx.get(db.doc('settings/general'))).data());
    const digits = (value: string) => value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
    if (!data || typeof data.phone !== 'string' || digits(data.phone) !== digits(verifiedPhone)) throw new ReservationError('Unable to recover this link. Verify the phone used for the booking or call the restaurant.', 403);
    tx.set(db.doc(`managementAccess/${id}`), { hash: tokenHash(token), encryptedToken, expiresAt: Math.max(Date.now() + 86400000, new Date(`${dateString(data.date, timezone)}T23:59:59Z`).getTime() + 31 * 86400000) });
    tx.update(ref, { phoneVerified: true, phoneVerificationSource: 'server' });
    tx.create(ref.collection('events').doc(eventId), { event: 'reservation.access_recovered', actor: 'verified-guest', timestamp: new Date(), correlationId: eventId });
    notificationIntent(tx, id, eventId, 'recovered', notificationRecord(data, timezone), encryptedToken);
  });
  scheduleDelivery(eventId);
  return { success: true, managementUrl: managementUrl(id, token) };
}
export async function queueReminder(id: string, channel: 'email' | 'sms') {
  if (channel === 'sms') {
    const capability = smsReminderCapability(process.env, capturesNotifications());
    if (!capability.available) throw new ReservationError(capability.reason, 409);
  }
  const db = getServerDatabase(), eventId = randomUUID();
  await db.runTransaction(async tx => {
    const ref = db.doc(`reservations/${reservationId(id)}`), data = (await tx.get(ref)).data(), access = await tx.get(db.doc(`managementAccess/${id}`));
    const timezone = businessTimezone((await tx.get(db.doc('settings/general'))).data());
    if (!data || !isGuestEditable(bookingState(data))) throw new ReservationError('This reservation is not eligible for a reminder', 409);
    if (channel === 'sms' && (data.smsOptIn !== true || data.phoneVerified !== true || data.phoneVerificationSource !== 'server')) throw new ReservationError('SMS requires recorded consent and a server-verified phone', 409);
    let encryptedToken = access.data()?.encryptedToken;
    if (!encryptedToken || access.data()!.expiresAt <= Date.now()) {
      const fresh = newManagementToken(); encryptedToken = encryptToken(fresh);
      tx.set(db.doc(`managementAccess/${id}`), { hash: tokenHash(fresh), encryptedToken, expiresAt: Math.max(Date.now() + 86400000, new Date(`${dateString(data.date, timezone)}T23:59:59Z`).getTime() + 31 * 86400000) });
    }
    if (data.reminderQueuedAt?.toMillis() > Date.now() - 300000) throw new ReservationError('A reminder was already queued recently', 429);
    tx.update(ref, { reminderQueuedAt: new Date() });
    notificationIntent(tx, id, eventId, 'reminder', notificationRecord(data, timezone), encryptedToken, channel);
    tx.create(ref.collection('events').doc(eventId), { event: 'reservation.reminder_queued', actor: 'staff', timestamp: new Date(), correlationId: eventId });
  });
  scheduleDelivery(eventId);
  return { success: true, queued: true };
}
