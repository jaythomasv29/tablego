import { requireAdmin } from '@/lib/auth/admin';
import { queueReminder } from '@/lib/reservations/repository';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { reservationId } = await request.json();
    return privateJson(await queueReminder(reservationId, 'email'));
  } catch (error) { return reservationError(error); }
}
