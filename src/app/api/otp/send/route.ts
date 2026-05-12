import { NextResponse } from 'next/server';
import client, { toE164 } from '@/lib/twilio';

export async function POST(request: Request) {
  try {
    const { phone } = await request.json();
    if (!phone) {
      return NextResponse.json({ success: false, error: 'Phone is required' }, { status: 400 });
    }

    const to = toE164(phone);

    await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verifications.create({ to, channel: 'sms' });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[otp/send]', error);
    return NextResponse.json({ success: false, error: 'Failed to send verification code' }, { status: 500 });
  }
}
