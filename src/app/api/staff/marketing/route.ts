import { after } from 'next/server';
import { adminSession, requireAdmin } from '@/lib/auth/admin';
import { marketingQueue, approveMarketing } from '@/lib/marketing/repository';
import { deliverNotification } from '@/lib/reservations/notifications';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export const maxDuration = 60;
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { return privateJson(await marketingQueue()); } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const { ids, action, previews } = await request.json();
    if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) || !['approve', 'dismiss'].includes(action)) throw new ReservationError('Select 1–50 customers and a valid action');
    if (!previews || typeof previews !== 'object' || Array.isArray(previews)) throw new ReservationError('Email previews are required');
    const selected = Array.from(new Set(ids)) as string[];
    const session = await adminSession(request);
    if (!session) throw new ReservationError('Authentication required', 401);
    const result = await approveMarketing(selected, session.id, action, previews);
    if (action === 'approve') after(async () => {
      // Bound SMTP concurrency. Persistent worker recovers interruptions.
      for (let i = 0; i < selected.length; i += 5) await Promise.allSettled(selected.slice(i, i + 5).map(id => deliverNotification(`marketing-${id}`)));
    });
    return privateJson(result);
  } catch (error) { return reservationError(error); }
}
