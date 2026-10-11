import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { validateHours } from '@/lib/restaurant/hours';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
export async function PUT(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    let hours; try { hours = validateHours(await request.json()); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid hours'); }
    await getServerDatabase().doc('settings/businessHours').set(hours);
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
