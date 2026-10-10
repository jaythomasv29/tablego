import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const jobs = getServerDatabase().collection('notificationOutbox');
    const entries = await Promise.all(['queued', 'failed', 'sending', 'exhausted'].map(async state => [state, (await jobs.where('state', '==', state).count().get()).data().count] as const));
    return privateJson({ counts: Object.fromEntries(entries) });
  } catch (error) { return reservationError(error); }
}
