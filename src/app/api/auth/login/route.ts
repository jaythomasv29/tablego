import { NextResponse } from 'next/server';
import { adminSessionDuration, validAdminCredentials, validAdminPin } from '@/lib/auth/adminCredentials';
import { issueSignedToken } from '@/lib/auth/signedToken';
import { secureCookie, staffFirebaseToken, validMutationOrigin } from '@/lib/auth/admin';
import { getServerDatabase } from '@/lib/serverFirebase';
import { defaultRestaurant } from '@/lib/restaurant/config';
import { rateLimit } from '@/lib/auth/rateLimit';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  let input;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { username, password, remember, pin } = input || {};
  const pinLogin = Object.prototype.hasOwnProperty.call(input || {}, 'pin');
  if (pinLogin ? typeof pin !== 'string' || !/^\d{4}$/.test(pin) : typeof username !== 'string' || typeof password !== 'string' || password.length > 1024) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  if (!process.env.ADMIN_SESSION_SECRET) {
    return NextResponse.json({ error: 'Staff authentication is not configured' }, { status: 503 });
  }
  const limited = await rateLimit('staff-login', 'staff', 30, 900);
  if (limited) return limited;
  try {
    let authenticated = false;
    if (pinLogin) {
      const settings = (await getServerDatabase().doc('settings/general').get()).data();
      const phone = settings?.restaurant?.phone ?? defaultRestaurant.phone;
      authenticated = typeof phone === 'string' && validAdminPin(pin, phone);
    } else {
      authenticated = validAdminCredentials(username, password);
    }
    if (!authenticated) return NextResponse.json({ success: false }, { status: 401 });
    const maxAge = adminSessionDuration(remember === true);
    const { token, claims } = await issueSignedToken('admin', { username: pinLogin ? 'restaurant-pin' : username }, maxAge);
    const firebaseToken = await staffFirebaseToken(claims);
    await getServerDatabase().doc(`staffSessions/${claims.id}`).set({ active: true, expiresAt: claims.expiresAt, createdAt: new Date() });
    const response = NextResponse.json({ success: true, firebaseToken }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set('company-auth', token, { path: '/', maxAge, secure: secureCookie(request), sameSite: 'lax', httpOnly: true });
    return response;
  } catch {
    return NextResponse.json({ error: 'Unable to establish staff session' }, { status: 503 });
  }
}
