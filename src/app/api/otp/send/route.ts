import { NextResponse } from 'next/server';
import { sendVerificationCode, toE164 } from '@/lib/twilio';
import { validMutationOrigin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const { phone } = await request.json() || {};
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 });
    }

    let to;
    try { to = toE164(phone); } catch { return NextResponse.json({ success: false, error: 'Enter a valid US phone number' }, { status: 400 }); }
    const limited = await rateLimit('otp-send', to, 3, 600);
    if (limited) return limited;
    const total = await rateLimit('otp-send-total', 'site', 100, 600);
    if (total) return total;

    await sendVerificationCode(to);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
    console.warn('[otp/send] verification provider unavailable');
    return NextResponse.json({ success: false, error: 'Failed to send verification code' }, { status: 500 });
  }
}
