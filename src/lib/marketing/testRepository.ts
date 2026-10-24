import { createHash } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { restaurantIdentity } from '../restaurant/config';
import { ReservationError } from '../reservations/http';
import { marketingCopy, marketingTestMessage } from './render';
import { marketingTestInput } from './testInput';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function marketingTestConfiguration() {
  const settings = (await getServerDatabase().doc('settings/general').get()).data();
  const restaurant = restaurantIdentity(settings?.restaurant);
  const base = new URL(process.env.NEXT_PUBLIC_BASE_URL || '');
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Public base URL is required.');
  const baseUrl = base.origin;
  const templates = (['reservation', 'catering'] as const).map(kind => marketingTestMessage(marketingCopy({ kind, name: 'Guest' }, restaurant, baseUrl)));
  return { restaurant, baseUrl, configurationVersion: hash(JSON.stringify({ restaurant, baseUrl, templates })) };
}
export async function queueMarketingTest(value: unknown, actor: string) {
  let input;
  try { input = marketingTestInput(value); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid test details.'); }
  const config = await marketingTestConfiguration();
  if (input.configurationVersion !== config.configurationVersion) throw new ReservationError('The email preview changed. Reload it and review again before sending.', 409);
  const copy = marketingCopy(input, config.restaurant, config.baseUrl);
  const fingerprint = hash(JSON.stringify({ email: input.email, kind: input.kind, ...copy }));
  const id = `marketing-test-${hash(`${actor}:${input.key}`)}`, db = getServerDatabase(), ref = db.doc(`notificationOutbox/${id}`);
  await db.runTransaction(async tx => {
    const existing = (await tx.get(ref)).data();
    if (existing) {
      if (existing.fingerprint !== fingerprint) throw new ReservationError('This test request was already used for different details.', 409);
      return;
    }
    tx.create(ref, { kind: 'marketing-test', email: input.email, name: input.name, templateKind: input.kind, ...copy, fingerprint,
      approvedBy: actor, recipient: 'test', channel: 'email', state: 'queued', attempts: 0, nextAttemptAt: new Date(), createdAt: new Date() });
  });
  return { id, state: 'queued' };
}
export async function marketingTestStatus(id: string, actor: string) {
  if (!/^marketing-test-[a-f0-9]{64}$/.test(id)) throw new ReservationError('Invalid test email.', 400);
  const record = (await getServerDatabase().doc(`notificationOutbox/${id}`).get()).data();
  if (!record || record.kind !== 'marketing-test' || record.approvedBy !== actor) throw new ReservationError('Test email not found.', 404);
  return { state: record.state as string, deliveryMode: record.deliveryMode as string | undefined, attempts: record.attempts as number };
}
