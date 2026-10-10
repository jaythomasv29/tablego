import { NextResponse } from 'next/server';
import { sendVerificationCode, toE164 } from '@/lib/twilio';
import { validMutationOrigin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';

export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 });
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 });
    }

    const to = toE164(phone);
    const limited = await rateLimit('otp-send', to, 3, 600);
    if (limited) return limited;
    const total = await rateLimit('otp-send-total', 'site', 100, 600);
    if (total) return total;

    await sendVerificationCode(to);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[otp/send]', error);
    return NextResponse.json({ success: false, error: 'Failed to send verification code' }, { status: 500 });
  }
}
