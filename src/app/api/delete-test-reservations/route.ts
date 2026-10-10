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
    for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
      const batch = db.batch();
      for (const record of snapshot.docs.slice(offset, offset + 400)) batch.delete(record.ref);
      await batch.commit();
    }
    return NextResponse.json({ success: true, deleted: snapshot.size });
  } catch {
    return NextResponse.json({ error: 'Failed to delete test reservations' }, { status: 503 });
  }
}
