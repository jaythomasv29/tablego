import { createHash } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { contactId } from '../mailing/repository';
import { TEST_RECIPIENT, type Campaign } from './policy';
const events = new Set(['email.sent', 'email.delivered', 'email.delivery_delayed', 'email.bounced', 'email.complained', 'email.failed', 'email.suppressed', 'email.opened', 'email.clicked']);
export async function applyCampaignWebhook(event: unknown, eventId: string) {
  if (!event || typeof event !== 'object') return;
  const value = event as { type?: string; created_at?: string; data?: { email_id?: string; to?: string[]; tags?: Record<string, string> } };
  const type = value.type || '', data = value.data, id = data?.tags?.tablego_campaign, index = Number(data?.tags?.touchpoint);
  if (!events.has(type) || !id || !/^[a-f0-9-]{36}$/.test(id) || !/^\d$/.test(data?.tags?.touchpoint || '') || !Number.isInteger(index) || typeof data?.email_id !== 'string' || !Array.isArray(data.to) || data.to.length !== 1 || data.to[0]?.toLowerCase() !== TEST_RECIPIENT) return;
  const db = getServerDatabase(), ref = db.doc(`emailCampaigns/${id}`), history = ref.collection('events').doc(createHash('sha256').update(eventId).digest('hex'));
  await db.runTransaction(async tx => {
    const [snapshot, existing, recipient] = await Promise.all([tx.get(ref), tx.get(history), tx.get(db.doc(`campaignRecipients/${contactId(TEST_RECIPIENT)}`))]);
    const campaign = snapshot.data() as Campaign | undefined, message = campaign?.messages[index];
    if (!campaign || campaign.provider !== 'resend' || existing.exists || !message || !['sending', 'accepted', 'uncertain', 'failed', 'skipped'].includes(message.state) || message.state === 'skipped' && !message.attemptedAt && !message.providerId || (message.providerId && message.providerId !== data.email_id)) return;
    const active = recipient.data()?.activeCampaignId;
    const otherCampaign = typeof active === 'string' && active !== id && /^[a-f0-9-]{36}$/.test(active) ? await tx.get(db.doc(`emailCampaigns/${active}`)) : null;
    const at = typeof value.created_at === 'string' && Number.isFinite(Date.parse(value.created_at)) ? new Date(value.created_at).toISOString() : new Date().toISOString();
    const telemetry = { ...message.telemetry, [type.slice(6)]: at };
    const blocked = ['email.bounced', 'email.complained', 'email.suppressed'].includes(type), failure = blocked || type === 'email.failed';
    const messages = campaign.messages.map((m, i) => i === index ? { ...m, providerId: data.email_id, telemetry } : m);
    tx.update(ref, { messages, version: campaign.version + 1, ...(failure && campaign.status === 'running' ? { status: 'paused' } : {}) });
    tx.create(history, { type, touchpoint: index, providerId: data.email_id, timestamp: at, receivedAt: new Date() });
    if (blocked && recipient.exists) {
      tx.set(recipient.ref, { suppressed: true, suppressionReason: type, suppressedAt: new Date().toISOString() }, { merge: true });
      if (otherCampaign?.exists && otherCampaign.data()?.status === 'running') tx.update(otherCampaign.ref, { status: 'paused', version: Number(otherCampaign.data()?.version) + 1 });
    }
  });
}
