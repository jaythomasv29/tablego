import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const snapshot = await getServerDatabase().collection('reservations').where('status', '==', 'pending').get();
    return NextResponse.json({ pendingReservations: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
  } catch {
    return NextResponse.json({ error: 'Failed to check reservations' }, { status: 503 });
  }
}
