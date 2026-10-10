import { NextResponse } from 'next/server';
import { adminSession, secureCookie, validMutationOrigin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  try {
    const session = await adminSession(request);
    if (session) await getServerDatabase().doc(`staffSessions/${session.id}`).update({ active: false, endedAt: new Date() });
    const response = NextResponse.json({ success: true });
    response.cookies.set('company-auth', '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: secureCookie(request) });
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to end staff session' }, { status: 503 });
  }
}
