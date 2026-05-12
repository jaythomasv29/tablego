import { NextResponse } from 'next/server';
import client, { toE164 } from '@/lib/twilio';

export async function POST(request: Request) {
  try {
    const { phone, code } = await request.json();
    if (!phone || !code) {
      return NextResponse.json({ success: false, error: 'Phone and code are required' }, { status: 400 });
    }

    const to = toE164(phone);

    const verification = await client.verify.v2
      .services(process.env.TWILIO_VERIFY_SERVICE_SID!)
      .verificationChecks.create({ to, code });

    return NextResponse.json({ success: true, valid: verification.status === 'approved' });
  } catch (error) {
    console.error('[otp/verify]', error);
    return NextResponse.json({ success: false, error: 'Failed to verify code' }, { status: 500 });
  }
}
