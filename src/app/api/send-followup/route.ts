import { requireAdmin } from '@/lib/auth/admin';
import { queueFollowUp } from '@/lib/reservations/feedbackRepository';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const body = await request.json();
    if (!body || Object.keys(body).some(key => key !== 'reservationIds') || !Array.isArray(body.reservationIds) || !body.reservationIds.length || body.reservationIds.length > 25 ||
      body.reservationIds.some((id: unknown) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id))) throw new ReservationError('Choose 1–25 saved reservations');
    const results = [];
    for (const id of Array.from(new Set<string>(body.reservationIds))) {
      try { results.push({ id, ...await queueFollowUp(id) }); }
      catch (error) { results.push({ id, success: false, error: error instanceof ReservationError ? error.message : 'Unable to queue follow-up' }); }
    }
    return privateJson({ results });
  } catch (error) { return reservationError(error); }
}
