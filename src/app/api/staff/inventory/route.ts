import { adminSession, requireAdmin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { getInventoryHistory, getInventory, saveInventory } from '@/lib/inventory/repository';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { const item = new URL(request.url).searchParams.get('history'); return privateJson(item ? await getInventoryHistory(item) : await getInventory()); } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const session = await adminSession(request); if (!session) throw new ReservationError('Authentication required', 401);
    const limited = await rateLimit('inventory', session.id, 180, 60); if (limited) return limited;
    return privateJson(await saveInventory(await request.json(), session.id));
  } catch (error) { return reservationError(error); }
}
