import { requireAdmin } from '@/lib/auth/admin';
import { isNotificationWorker, processNotifications } from '@/lib/reservations/worker';
import { privateJson, reservationError } from '@/lib/reservations/http';
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!isNotificationWorker(request)) return privateJson({ error: 'Worker authentication required' }, 401);
  try { return privateJson(await processNotifications()); } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  if (!isNotificationWorker(request)) { const denied = await requireAdmin(request); if (denied) return denied; }
  try { return privateJson(await processNotifications()); } catch (error) { return reservationError(error); }
}
