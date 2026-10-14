import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { loadContacts } from '@/lib/mailing/repository';
import { preferenceUrl } from '@/lib/mailing/render';
import { decryptToken } from '@/lib/reservations/managementToken';
import { reservationError } from '@/lib/reservations/http';
const csv = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
export const maxDuration = 60;
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const { contacts } = await loadContacts(), db = getServerDatabase();
    const rows = ['Email,Confirmed at (UTC),Consent version,Unsubscribe URL'];
    const subscribers = contacts.filter(contact => contact.status === 'subscribed');
    // Bounded bulk reads keep larger lists fast and recheck opt-outs before export.
    for (let start = 0; start < subscribers.length; start += 100) {
      const batch = subscribers.slice(start, start + 100);
      const snapshots = await db.getAll(...batch.flatMap(contact => [db.doc(`mailingContacts/${contact.id}`), db.doc(`mailingAccess/${contact.id}`)]));
      const records = new Map(snapshots.map(snapshot => [snapshot.ref.path, snapshot.data()]));
      for (const contact of batch) {
        const current = records.get(`mailingContacts/${contact.id}`), access = records.get(`mailingAccess/${contact.id}`);
        if (current?.status !== 'subscribed' || current.version !== contact.version || !access?.encryptedUnsubscribe) continue;
        rows.push([contact.email, contact.confirmedAt, contact.consentVersion, preferenceUrl(contact.id, decryptToken(access.encryptedUnsubscribe), 'unsubscribe')].map(csv).join(','));
      }
    }
    return new Response(rows.join('\r\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="thaiphoon-subscribers.csv"', 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
  } catch (error) { return reservationError(error); }
}
