import { automaticConfirmation } from '@/lib/reservations/domain';
import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { restaurantIdentity, validateGeneral } from '@/lib/restaurant/config';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const data = (await getServerDatabase().doc('settings/general').get()).data();
    if (!data) throw new ReservationError('Business settings are missing', 503);
    const settings = { autoConfirmReservations: automaticConfirmation(data.autoConfirmReservations), timezone: data.timezone, reservationCutoffMinutes: data.reservationCutoffMinutes ?? 60,
      minimumLeadTimeMinutes: data.minimumLeadTimeMinutes ?? 50, restaurant: restaurantIdentity(data.restaurant), version: data.version || 0 };
    try { validateGeneral(settings); } catch { throw new ReservationError('Business settings need correction before use', 503); }
    return privateJson(settings);
  } catch (error) { return reservationError(error); }
}
export async function PUT(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const body = await request.json();
    let settings; try { settings = validateGeneral(body); } catch (error) { throw new ReservationError(error instanceof Error ? error.message : 'Invalid settings'); }
    const db = getServerDatabase(), ref = db.doc('settings/general');
    await db.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      if ((current?.version || 0) !== body.version) throw new ReservationError('Settings changed in another window. Reload before saving.', 409);
      // Older open staff tabs omit the new field; preserve a saved manual mode.
      if (body.autoConfirmReservations === undefined && current?.autoConfirmReservations !== undefined) settings.autoConfirmReservations = automaticConfirmation(current.autoConfirmReservations);
      tx.set(ref, { ...settings, version: body.version + 1, updatedAt: new Date() }, { merge: true });
    });
    return privateJson({ success: true, version: body.version + 1 });
  } catch (error) { return reservationError(error); }
}
