import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { businessTimezone } from '@/lib/reservations/policy';
import { privateJson, reservationError } from '@/lib/reservations/http';
import { cateringLead, cateringRecord } from '@/lib/catering/admin';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const db = getServerDatabase();
    const [settings, records, staffRecords] = await Promise.all([db.doc('settings/general').get(), db.collection('catering').get(), db.collection('cateringStaff').get()]);
    const staff = new Map(staffRecords.docs.map(doc => [doc.id, doc.data()]));
    const timezone = businessTimezone(settings.data());
    return privateJson({ timezone, leads: records.docs.map(doc => cateringLead(doc.id, cateringRecord(doc.data(), staff.get(doc.id)), timezone)) });
  } catch (error) { return reservationError(error); }
}
