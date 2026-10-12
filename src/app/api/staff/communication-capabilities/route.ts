import { requireAdmin } from '@/lib/auth/admin';
import { capturesNotifications } from '@/lib/notificationTransport';
import { smsReminderCapability } from '@/lib/reservations/communications';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { return privateJson({ smsReminders: smsReminderCapability(process.env, capturesNotifications()) }); }
  catch (error) { return reservationError(error); }
}
