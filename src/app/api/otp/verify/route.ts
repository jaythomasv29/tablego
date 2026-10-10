import { NextResponse } from 'next/server';
import { issueSignedToken } from '@/lib/auth/signedToken';
import { secureCookie, validMutationOrigin } from '@/lib/auth/admin';
import { verifyPhoneCode, toE164 } from '@/lib/twilio';
import { rateLimit } from '@/lib/auth/rateLimit';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  try {
    const { phone, code } = await request.json() || {};
    if (!phone || !code) {
      return NextResponse.json({ success: false, error: 'Phone and code are required' }, { status: 400 });
    }

    let to;
    try { to = toE164(phone); } catch { return NextResponse.json({ success: false, error: 'Enter a valid US phone number' }, { status: 400 }); }
    const limited = await rateLimit('otp-verify', to, 10, 600);
    if (limited) return limited;

    if (typeof code !== 'string' || !/^\d{4,10}$/.test(code)) {
      return NextResponse.json({ success: false, error: 'Invalid code' }, { status: 400 });
    }
    const valid = await verifyPhoneCode(to, code);
    const response = NextResponse.json({ success: true, valid });
    if (valid) {
      const { token } = await issueSignedToken('phone', { phone: to }, 600);
      response.cookies.set('phone-verification', token, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax', secure: secureCookie(request) });
    }
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    console.warn('[otp/verify] verification provider unavailable');
    return NextResponse.json({ success: false, error: 'Failed to verify code' }, { status: 500 });
  }
}
