import { after } from 'next/server';
import { adminSession, requireAdmin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { deliverNotification } from '@/lib/reservations/notifications';
import { changeWork, getWorkBoard, getWorkHistory, saveWorkSettings } from '@/lib/work/repository';
export const maxDuration = 60;
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { const params = new URL(request.url).searchParams; return privateJson(params.has('history') ? await getWorkHistory(params.get('date') || '') : await getWorkBoard(params.get('date'))); }
  catch (error) { return reservationError(error); }
}
async function mutate(request: Request, settings: boolean) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const session = await adminSession(request);
    if (!session) throw new ReservationError('Authentication required', 401);
    const limited = await rateLimit('work', session.id, 120, 60); if (limited) return limited;
    const body = await request.json();
    if (settings) return privateJson(await saveWorkSettings(body, session.id));
    const result = await changeWork(body, session.id);
    if (result.notificationIds.length) after(async () => { await Promise.allSettled(result.notificationIds.map(deliverNotification)); });
    return privateJson(result);
  } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) { return mutate(request, false); }
export async function PUT(request: Request) { return mutate(request, true); }
