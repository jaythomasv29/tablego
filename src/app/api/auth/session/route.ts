import { NextResponse } from 'next/server';
import { adminSession, staffFirebaseToken } from '@/lib/auth/admin';

export async function GET(request: Request) {
  try {
    const session = await adminSession(request);
    if (!session) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    return NextResponse.json({ firebaseToken: await staffFirebaseToken(session), expiresAt: session.expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Unable to verify staff session' }, { status: 503 });
  }
}
