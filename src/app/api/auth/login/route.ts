import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { issueSignedToken } from '@/lib/auth/signedToken';
import { secureCookie, staffFirebaseToken, validMutationOrigin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { rateLimit } from '@/lib/auth/rateLimit';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { username, password, remember } = input || {};
  if (typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: 'Staff authentication is not configured' }, { status: 503 });
  }
  const hash = (value: string) => createHash('sha256').update(value).digest();
  const limited = await rateLimit('staff-login', 'staff', 30, 900);
  if (limited) return limited;
  if (username !== process.env.ADMIN_USERNAME || !timingSafeEqual(hash(password), hash(process.env.ADMIN_PASSWORD))) {
    return NextResponse.json({ success: false }, { status: 401 });
  }
  try {
    const maxAge = remember === true ? 60 * 60 * 24 * 7 : 60 * 60 * 24;
    const { token, claims } = await issueSignedToken('admin', { username }, maxAge);
    const firebaseToken = await staffFirebaseToken(claims);
    await getServerDatabase().doc(`staffSessions/${claims.id}`).set({ active: true, expiresAt: claims.expiresAt, createdAt: new Date() });
    const response = NextResponse.json({ success: true, firebaseToken }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('company-auth', token, { path: '/', maxAge, secure: secureCookie(request), sameSite: 'lax', httpOnly: true });
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to establish staff session' }, { status: 503 });
  }
}
