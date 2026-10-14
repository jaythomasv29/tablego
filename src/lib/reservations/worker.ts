import { createHash, timingSafeEqual } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { deliverNotification } from './notifications';
import { prunePendingSignups } from '../mailing/repository';
export function isNotificationWorker(request: Request): boolean {
  const secret = process.env.CRON_SECRET || '';
  const authorization = request.headers.get('authorization') || '';
  if (secret.length < 32 || authorization.length > 1024 || !authorization.startsWith('Bearer ')) return false;
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(authorization.slice(7)), hash(secret));
}
export async function processNotifications() {
  const jobs = await getServerDatabase().collection('notificationOutbox').where('state', 'in', ['queued', 'failed', 'sending'])
    .where('nextAttemptAt', '<=', new Date()).orderBy('nextAttemptAt').limit(5).get();
  const counts = { scanned: jobs.size, delivered: 0, failed: 0, skipped: 0 };
  // Small batches and per-job transactional leases prevent concurrent sends.
  for (let start = 0; start < jobs.docs.length; start += 5) {
    const results = await Promise.allSettled(jobs.docs.slice(start, start + 5).map(job => deliverNotification(job.id)));
    for (const result of results) {
      if (result.status === 'fulfilled') counts[result.value]++; else counts.failed++;
    }
  }
  await prunePendingSignups();
  return counts;
}
