import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (process.env.TABLEGO_ENVIRONMENT !== 'staging') {
    return NextResponse.json({ error: 'Test cleanup is only available in staging' }, { status: 403 });
  }
  try {
    const db = getServerDatabase();
    const snapshot = await db.collection('reservations').where('isTest', '==', true).get();
    for (const record of snapshot.docs) {
      const [jobs, submissions] = await Promise.all([
        db.collection('notificationOutbox').where('reservationId', '==', record.id).get(),
        db.collection('bookingSubmissions').where('reservationId', '==', record.id).get(),
      ]);
      for (const related of [...jobs.docs, ...submissions.docs]) await related.ref.delete();
      await db.recursiveDelete(db.doc('managementAccess/' + record.id));
      await db.recursiveDelete(record.ref);
    }
    return NextResponse.json({ success: true, deleted: snapshot.size });
  } catch {
    return NextResponse.json({ error: 'Failed to delete test reservations' }, { status: 503 });
  }
}
