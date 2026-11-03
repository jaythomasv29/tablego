import { requireAdmin } from '@/lib/auth/admin';
import { getDailyStock } from '@/lib/inventory/dailyStockRepository';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try { return privateJson(await getDailyStock()); }
  catch (error) { return reservationError(error); }
}
