import { requireAdmin, validMutationOrigin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { rateLimit } from '@/lib/auth/rateLimit';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const snapshot = await getServerDatabase().collection('analytics').where('timestamp', '>=', new Date(Date.now() - 7 * 86400000)).orderBy('timestamp', 'desc').get();
    const dailyViews = snapshot.docs.map(doc => ({ date: doc.data().timestamp.toDate().toISOString(), views: Number(doc.data().pageViews) || 0 }));
    const [downloads, catering] = await Promise.all([getServerDatabase().collection('menuDownloads').count().get(), getServerDatabase().collection('catering').where('status', '==', 'pending').count().get()]);
    return privateJson({ menuDownloads: downloads.data().count, pendingCatering: catering.data().count, pageViews: { value: dailyViews.reduce((sum, day) => sum + day.views, 0), timestamp: new Date().toISOString() }, dailyViews });
  } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return privateJson({ error: 'Invalid origin' }, 403);
  try {
    const { page } = await request.json();
    if (typeof page !== 'string' || !page.startsWith('/') || page.length > 200) return privateJson({ error: 'Invalid page' }, 400);
    const limited = await rateLimit('analytics', 'site', 1000, 60);
    if (limited) return limited;
    await getServerDatabase().collection('analytics').add({ page: page.split('?')[0], pageViews: 1, timestamp: new Date() });
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
