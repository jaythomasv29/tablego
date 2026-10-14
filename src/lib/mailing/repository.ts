import { createHmac, randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getServerDatabase } from '../serverFirebase';
import { encryptToken, newManagementToken, tokenHash } from '../reservations/managementToken';
import { ReservationError } from '../reservations/http';
import { CONSENT_TEXT, CONSENT_VERSION, mergeContacts, mailingCounts } from './policy';

export function contactId(email: string) {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (secret.length < 32) throw new Error('Missing server secret');
  return createHmac('sha256', secret).update(`tablego-mailing:${email}`).digest('hex');
}
export async function requestSignup(email: string, source: 'modal' | 'banner') {
  const db = getServerDatabase(), id = contactId(email), ref = db.doc(`mailingContacts/${id}`), access = db.doc(`mailingAccess/${id}`);
  return db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data(), oldAccess = (await tx.get(access)).data(), now = Date.now();
    // Uniform responses, no redundant emails, and no silent reactivation after opt-out.
    if (record?.status === 'subscribed' || (record?.requestedAt?.toMillis() > now - 10 * 60_000)) return null;
    const version = (record?.version || 0) + 1, confirmation = newManagementToken(), unsubscribe = newManagementToken(), eventId = randomUUID();
    const unsubscribed = record?.status === 'unsubscribed';
    tx.set(ref, { email, status: unsubscribed ? 'unsubscribed' : 'pending', version,
      sources: Array.from(new Set([...(record?.sources || []), source])), requestedAt: new Date(now),
      consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION, noticeVersion: CONSENT_VERSION,
      ...(unsubscribed ? {} : { expiresAt: new Date(now + 30 * 86400_000) }) }, { merge: true });
    tx.set(access, { confirmationHash: tokenHash(confirmation), encryptedConfirmation: encryptToken(confirmation),
      // Existing unsubscribe links continue to work across fresh consent attempts.
      unsubscribeHash: oldAccess?.unsubscribeHash || tokenHash(unsubscribe), encryptedUnsubscribe: oldAccess?.encryptedUnsubscribe || encryptToken(unsubscribe),
      confirmationExpiresAt: now + 48 * 3600_000, confirmationVersion: version });
    tx.create(ref.collection('events').doc(eventId), { event: 'signup-requested', source, version, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION, timestamp: new Date(now) });
    tx.create(db.doc(`notificationOutbox/${eventId}-guest`), { kind: 'mailing-confirmation', entityId: id, recipient: 'guest', channel: 'email', version,
      state: 'queued', attempts: 0, nextAttemptAt: new Date(now), createdAt: new Date(now) });
    return eventId;
  });
}
export async function changePreference(id: string, token: string, action: 'confirm' | 'unsubscribe') {
  const hash = tokenHash(token);
  if (!/^[a-f0-9]{64}$/.test(id) || !hash) throw new ReservationError('This link is invalid. Please use a link from your email.', 403);
  const db = getServerDatabase(), ref = db.doc(`mailingContacts/${id}`), access = db.doc(`mailingAccess/${id}`);
  return db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data(), proof = (await tx.get(access)).data();
    if (!record || !proof || hash !== (action === 'confirm' ? proof.confirmationHash : proof.unsubscribeHash)) throw new ReservationError('This link is invalid. Please use a link from your email.', 403);
    if (action === 'confirm' && record.status === 'subscribed') return;
    if (action === 'confirm' && (proof.confirmationExpiresAt <= Date.now() || proof.confirmationVersion !== record.version)) throw new ReservationError('This confirmation link has expired. Please sign up again for a new link.', 410);
    const status = action === 'confirm' ? 'subscribed' : 'unsubscribed';
    if (record.status === status && (action === 'confirm' || proof.confirmationVersion === -1)) return;
    tx.update(ref, { status, version: record.version + 1, [action === 'confirm' ? 'confirmedAt' : 'unsubscribedAt']: new Date(), expiresAt: FieldValue.delete() });
    // A confirmation cannot reactivate an address after a later unsubscribe.
    tx.update(access, { confirmationVersion: -1 });
    tx.create(ref.collection('events').doc(randomUUID()), { event: status, actor: 'guest', version: record.version + 1, timestamp: new Date(), consentVersion: record.consentVersion });
  });
}
export async function staffUnsubscribe(id: string, version: number) {
  if (!/^[a-f0-9]{64}$/.test(id) || !Number.isInteger(version) || version < 1) throw new ReservationError('Reload the mailing list before making a change.');
  const db = getServerDatabase(), ref = db.doc(`mailingContacts/${id}`);
  await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || record.version !== version) throw new ReservationError('This contact has changed. Refresh the list and try again.', 409);
    if (record.status === 'unsubscribed') return;
    tx.update(ref, { status: 'unsubscribed', version: version + 1, unsubscribedAt: new Date(), expiresAt: FieldValue.delete() });
    tx.set(db.doc(`mailingAccess/${id}`), { confirmationVersion: -1 }, { merge: true });
    tx.create(ref.collection('events').doc(randomUUID()), { event: 'unsubscribed', actor: 'staff', timestamp: new Date(), version: version + 1 });
  });
}
export async function loadContacts() {
  const db = getServerDatabase();
  const [reservations, catering, mailing] = await Promise.all(['reservations', 'catering', 'mailingContacts'].map(name => db.collection(name).select('email', 'status', 'sources', 'version', 'requestedAt', 'confirmedAt', 'unsubscribedAt', 'consentVersion').get()));
  const contacts = mergeContacts(reservations.docs.map(d => d.data()), catering.docs.map(d => d.data()), mailing.docs.map(d => d.data()), contactId);
  return { contacts, counts: mailingCounts(contacts) };
}
// Only unconfirmed new signups expire; suppression records survive to prevent accidental re-enrollment.
export async function prunePendingSignups() {
  const db = getServerDatabase(), expired = await db.collection('mailingContacts').where('expiresAt', '<=', new Date()).limit(20).get();
  for (const doc of expired.docs) {
    await db.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (current?.status !== 'pending' || current.expiresAt?.toMillis() > Date.now()) return false;
      const events = await tx.get(doc.ref.collection('events'));
      for (const event of events.docs) tx.delete(event.ref);
      tx.delete(doc.ref); tx.delete(db.doc(`mailingAccess/${doc.id}`)); return true;
    });
  }
}
