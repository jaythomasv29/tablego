import { requireAdmin } from '@/lib/auth/admin';
import { actOnReservation } from '@/lib/reservations/repository';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    return privateJson(await actOnReservation((await context.params).id, body.action, 'staff', undefined, body));
  } catch (error) { return reservationError(error); }
}
