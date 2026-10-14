import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { restaurantIdentity } from '../restaurant/config';
import { capturesNotifications, createEmailTransport } from '../notificationTransport';
import { contactId } from '../mailing/repository';
import { encryptToken, decryptToken, newManagementToken, tokenHash } from '../reservations/managementToken';
import { ReservationError } from '../reservations/http';
import { addDays, campaignInput, dueTouchpoint, localDate, TEST_RECIPIENT, type Campaign, type CampaignInput } from './policy';
import { renderCampaign } from './render';
import { assertCampaignProvider, campaignProvider, sendResend } from './provider';
const transport = createEmailTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 587), secure: Number(process.env.SMTP_PORT || 587) === 465, requireTLS: Number(process.env.SMTP_PORT || 587) !== 465, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
function campaignRef(id: unknown) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id)) throw new ReservationError('Choose a campaign.');
  return getServerDatabase().doc(`emailCampaigns/${id}`);
}
const recipientRef = () => getServerDatabase().doc(`campaignRecipients/${contactId(TEST_RECIPIENT)}`);
function input(value: unknown): CampaignInput { try { return campaignInput(value); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid campaign.'); } }
export async function listCampaigns() {
  const snapshot = await getServerDatabase().collection('emailCampaigns').orderBy('createdAt', 'desc').limit(100).get();
  return snapshot.docs.map(doc => { const { name, touchpoints, version, status, recipient, timezone, createdAt, launchedAt, messages, provider } = doc.data(); return { id: doc.id, name, touchpoints, version, status, recipient, timezone, createdAt, launchedAt, messages, ...(provider ? { provider } : {}) } as Campaign; });
}
export async function saveCampaign(value: unknown, id?: unknown, version?: unknown) {
  const details = input(value), db = getServerDatabase(), ref = id ? campaignRef(id) : db.doc(`emailCampaigns/${randomUUID()}`);
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref), data = existing.data() as Campaign | undefined;
    if (id && (!data || data.version !== version || data.status !== 'draft')) throw new ReservationError('This draft changed. Refresh before editing.', 409);
    if (!id) { const drafts = await tx.get(db.collection('emailCampaigns').where('status', '==', 'draft').limit(30)); if (drafts.size >= 30) throw new ReservationError('Cancel an unused draft before creating another.', 409); }
    const now = new Date().toISOString();
    tx.set(ref, { ...details, id: ref.id, version: (data?.version || 0) + 1, status: 'draft', recipient: TEST_RECIPIENT, timezone: '', createdAt: data?.createdAt || now, launchedAt: '', messages: [] } satisfies Campaign);
  });
  return ref.id;
}
export async function changeCampaign(id: unknown, version: unknown, action: unknown, index?: unknown) {
  const db = getServerDatabase(), ref = campaignRef(id), recipient = recipientRef();
  await db.runTransaction(async tx => {
    const [snapshot, recipientSnapshot, settings, mailing] = await Promise.all([tx.get(ref), tx.get(recipient), tx.get(db.doc('settings/general')), tx.get(db.doc(`mailingContacts/${contactId(TEST_RECIPIENT)}`))]);
    const c = snapshot.data() as Campaign | undefined, r = recipientSnapshot.data();
    if (!c || c.version !== version) throw new ReservationError('Campaign changed. Refresh and try again.', 409);
    const now = new Date(), at = now.toISOString();
    if (action === 'launch' && c.status === 'draft') {
      if (c.recipient !== TEST_RECIPIENT) throw new ReservationError('This rollout only permits the restaurant test address.');
      if (r?.suppressed || mailing.data()?.status === 'unsubscribed') throw new ReservationError('The test address has opted out. Its unsubscribe preference must be respected.', 409);
      if (r?.activeCampaignId && r.activeCampaignId !== c.id) throw new ReservationError('Only one test campaign can run at a time. Pause or cancel the existing test; cancel it to start another.', 409);
      input(c);
      try { assertCampaignProvider(); } catch { throw new ReservationError('Complete the Resend API key, verified sender, and webhook configuration before launch.', 409); }
      const timezone = settings.data()?.timezone || 'America/Los_Angeles';
      const today = localDate(now, timezone);
      if (c.touchpoints.some(p => p.expiresOn && p.expiresOn < addDays(today, p.day))) throw new ReservationError('An offer expires before its send date. Update the draft before launching.');
      const token = r?.encryptedUnsubscribe ? decryptToken(r.encryptedUnsubscribe) : newManagementToken();
      tx.set(recipient, { email: TEST_RECIPIENT, suppressed: false, activeCampaignId: c.id, authorization: 'owner-requested-single-recipient-test', authorizedAt: at, unsubscribeHash: tokenHash(token), encryptedUnsubscribe: encryptToken(token) }, { merge: true });
      tx.update(ref, { status: 'running', provider: campaignProvider(), version: c.version + 1, timezone, launchedAt: at, messages: c.touchpoints.map(p => ({ state: 'pending', dueOn: addDays(today, p.day), updatedAt: at, detail: '' })) });
    } else if (action === 'pause' && c.status === 'running') {
      tx.update(ref, { status: 'paused', version: c.version + 1 });
    } else if (action === 'resume' && c.status === 'paused') {
      if (r?.suppressed || mailing.data()?.status === 'unsubscribed') throw new ReservationError('This recipient has opted out.', 409);
      if (c.messages.some(m => ['failed', 'uncertain', 'sending'].includes(m.state) || m.state !== 'skipped' && m.telemetry?.failed)) throw new ReservationError('Resolve the send issue before resuming.', 409);
      tx.update(ref, { status: 'running', version: c.version + 1 });
    } else if (action === 'cancel' && ['draft', 'running', 'paused'].includes(c.status)) {
      tx.update(ref, { status: 'cancelled', version: c.version + 1, messages: c.messages.map(m => m.state === 'pending' ? { ...m, state: 'skipped', detail: 'Campaign cancelled', updatedAt: at } : m) });
      if (r?.activeCampaignId === c.id) tx.set(recipient, { activeCampaignId: null }, { merge: true });
    } else if (action === 'review' && c.status !== 'draft') {
      const stale = c.messages.findIndex(m => m.state === 'sending' && now.getTime() - Date.parse(m.updatedAt) > 120000);
      if (stale < 0) throw new ReservationError('No interrupted send needs review.', 409);
      tx.update(ref, { status: c.status === 'cancelled' ? 'cancelled' : 'paused', version: c.version + 1, messages: c.messages.map((m, i) => i === stale ? { ...m, state: 'uncertain', updatedAt: at, detail: 'Send interrupted; check the inbox before skipping. No automatic resend.' } : m) });
    } else if (action === 'skip' && c.status === 'paused' && Number.isInteger(index) && (['failed', 'uncertain'].includes(c.messages[Number(index)]?.state) || c.messages[Number(index)]?.state !== 'skipped' && c.messages[Number(index)]?.telemetry?.failed)) {
      const messages = c.messages.map((m, i) => i === index ? { ...m, state: 'skipped' as const, detail: 'Staff reviewed and skipped; no resend', updatedAt: at } : m);
      const complete = messages.every(m => ['accepted', 'captured', 'skipped'].includes(m.state));
      tx.update(ref, { messages, status: complete ? 'completed' : 'paused', version: c.version + 1 });
      if (complete && r?.activeCampaignId === c.id) tx.set(recipient, { activeCampaignId: null }, { merge: true });
    } else throw new ReservationError('That action is unavailable for the current campaign.', 409);
  });
}
export async function unsubscribeCampaign(token: unknown) {
  const hash = tokenHash(token); if (!hash) throw new ReservationError('This unsubscribe link is invalid.');
  const db = getServerDatabase(), ref = recipientRef();
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(ref), r = snapshot.data();
    if (!r || r.unsubscribeHash !== hash) throw new ReservationError('This unsubscribe link is invalid.');
    const campaign = r.activeCampaignId ? await tx.get(campaignRef(r.activeCampaignId)) : null;
    const contact = db.doc(`mailingContacts/${contactId(TEST_RECIPIENT)}`), access = db.doc(`mailingAccess/${contactId(TEST_RECIPIENT)}`);
    const [contactSnapshot, accessSnapshot] = await Promise.all([tx.get(contact), tx.get(access)]);
    if (r.suppressed && contactSnapshot.data()?.status === 'unsubscribed' && accessSnapshot.data()?.confirmationVersion === -1) return;
    tx.set(ref, { suppressed: true, unsubscribedAt: new Date().toISOString() }, { merge: true });
    if (campaign?.exists && ['running', 'paused'].includes(campaign.data()?.status)) tx.update(campaign.ref, { status: 'paused', version: Number(campaign.data()?.version) + 1 });
    // Also respect this preference in the ordinary mailing list, without creating a subscription.
    tx.set(contact, { email: TEST_RECIPIENT, status: 'unsubscribed', version: Number(contactSnapshot.data()?.version || 0) + 1, unsubscribedAt: new Date(), expiresAt: FieldValue.delete() }, { merge: true });
    tx.set(access, { confirmationVersion: -1 }, { merge: true });
    tx.create(contact.collection('events').doc(randomUUID()), { event: 'unsubscribed', actor: 'campaign-recipient', timestamp: new Date() });
  });
}
export async function deliverCampaign(id: string, immediate = false): Promise<string> {
  const db = getServerDatabase(), ref = campaignRef(id), recipient = recipientRef(), lease = randomUUID();
  const job = await db.runTransaction(async tx => {
    const [snapshot, recipientSnapshot, mailing, settings] = await Promise.all([tx.get(ref), tx.get(recipient), tx.get(db.doc(`mailingContacts/${contactId(TEST_RECIPIENT)}`)), tx.get(db.doc('settings/general'))]);
    const c = snapshot.data() as Campaign | undefined, r = recipientSnapshot.data(), now = new Date();
    if (!c || c.status !== 'running') return null;
    // SMTP has no idempotency guarantee. A stale lease requires human review, never an automatic resend.
    const stale = c.messages.findIndex(m => m.state === 'sending' && now.getTime() - Date.parse(m.updatedAt) > 120000);
    if (stale >= 0) { tx.update(ref, { status: 'paused', version: c.version + 1, messages: c.messages.map((m, i) => i === stale ? { ...m, state: 'uncertain', detail: 'Send interrupted. Delivery is unknown; inspect the inbox before skipping.', updatedAt: now.toISOString() } : m) }); return null; }
    if (c.messages.some(m => ['sending', 'uncertain', 'failed'].includes(m.state))) return null;
    if (!r || r.suppressed || r.activeCampaignId !== c.id || mailing.data()?.status === 'unsubscribed' || c.recipient !== TEST_RECIPIENT) { tx.update(ref, { status: 'paused', version: c.version + 1 }); return null; }
    const index = dueTouchpoint(c, now, immediate); if (index < 0) return null;
    const touch = c.touchpoints[index], today = localDate(now, c.timezone);
    if (touch.expiresOn && today > touch.expiresOn) {
      const messages = c.messages.map((m, i) => i === index ? { ...m, state: 'skipped' as const, detail: 'Offer expired before delivery', updatedAt: now.toISOString() } : m);
      const complete = messages.every(m => ['accepted', 'captured', 'skipped'].includes(m.state));
      tx.update(ref, { messages, status: complete ? 'completed' : 'running', version: c.version + 1 });
      if (complete) tx.set(recipient, { activeCampaignId: null }, { merge: true });
      return null;
    }
    const messages = c.messages.map((m, i) => i === index ? { ...m, state: 'sending' as const, attemptedAt: now.toISOString(), updatedAt: now.toISOString(), detail: '' } : m);
    tx.update(ref, { messages, lease, version: c.version + 1 });
    return { c, index, encryptedUnsubscribe: r.encryptedUnsubscribe as string, restaurant: restaurantIdentity(settings.data()?.restaurant) };
  });
  if (!job) return 'skipped';
  let state: 'accepted' | 'captured' | 'failed' | 'uncertain' = 'uncertain', providerId = '', detail = '';
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL; if (!base) throw new Error('Site URL missing');
    const token = decryptToken(job.encryptedUnsubscribe);
    const unsubscribe = `${base.replace(/\/$/, '')}/mailing/campaign-preferences#token=${token}`;
    const message = renderCampaign(job.c.touchpoints[job.index], job.restaurant, TEST_RECIPIENT, unsubscribe, base);
    const oneClickUrl = `${base.replace(/\/$/, '')}/api/campaigns/unsubscribe?token=${encodeURIComponent(token)}`;
    const usingResend = job.c.provider === 'resend' && !capturesNotifications();
    const result = usingResend ? { messageId: await sendResend(message, id, job.index, oneClickUrl) } : await transport.sendMail({ ...message, messageId: `<tablego-campaign-${id}-${job.index}@${new URL(base).hostname}>`, headers: { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } });
    if ('rejected' in result && result.rejected?.length) { state = 'failed'; detail = 'Email server rejected the recipient.'; }
    else { state = 'captured' in result && result.captured ? 'captured' : 'accepted'; providerId = String(result.messageId || ''); detail = state === 'captured' ? 'Staging capture only; no real email sent.' : usingResend ? 'Resend accepted. Delivery updates arrive through signed provider webhooks.' : 'SMTP accepted. Inbox delivery, opens, and clicks are not measured.'; }
  } catch { detail = 'Delivery could not be confirmed. Check the inbox before skipping; automatic resend is disabled to prevent duplicates.'; }
  await db.runTransaction(async tx => {
    const [snapshot, recipientSnapshot] = await Promise.all([tx.get(ref), tx.get(recipient)]), current = snapshot.data() as (Campaign & { lease?: string }) | undefined;
    if (!current || current.lease !== lease || current.messages[job.index]?.state !== 'sending') return;
    const now = new Date(), today = localDate(now, current.timezone);
    const messages = current.messages.map((m, i) => {
      if (i === job.index) return { ...m, state, providerId, detail, updatedAt: now.toISOString() };
      // A paused/delayed campaign never compresses the cadence into back-to-back emails.
      if (i > job.index && m.state === 'pending') { const minimum = addDays(today, current.touchpoints[i].day - current.touchpoints[job.index].day); return { ...m, dueOn: m.dueOn < minimum ? minimum : m.dueOn }; }
      return m;
    });
    const completed = messages.every(m => ['accepted', 'captured', 'skipped'].includes(m.state));
    const status = ['failed', 'uncertain'].includes(state) ? (current.status === 'cancelled' ? 'cancelled' : 'paused') : completed && current.status !== 'cancelled' ? 'completed' : current.status;
    tx.update(ref, { messages, status, lease: null, version: current.version + 1 });
    if (completed && recipientSnapshot.data()?.activeCampaignId === id) tx.set(recipient, { activeCampaignId: null }, { merge: true });
  });
  return state;
}
export async function processCampaigns() {
  const snapshot = await getServerDatabase().collection('emailCampaigns').where('status', '==', 'running').limit(2).get();
  const results = [];
  for (const doc of snapshot.docs) results.push(await deliverCampaign(doc.id));
  return results;
}
