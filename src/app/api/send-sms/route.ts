import { NextResponse } from 'next/server';
import client, { toE164 } from '@/lib/twilio';
import { db } from '../../../firebase';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

const formatDateForSMS = (date: string | object): string => {
  let dateStr = typeof date === 'string' ? date : '';

  if (typeof date === 'object' && date !== null && 'toDate' in (date as object)) {
    dateStr = (date as { toDate: () => Date }).toDate().toISOString().split('T')[0];
  } else if (typeof date === 'string' && date.includes('T')) {
    dateStr = date.split('T')[0];
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  return dateStr;
};

export async function POST(request: Request) {
  try {
    const { reservationId, phone, name, date, time, guests } = await request.json();

    if (!reservationId || !phone || !name || !date || !time || !guests) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const to = toE164(phone);
    const readableDate = formatDateForSMS(date);
    const cancelUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/cancel-reservation/${reservationId}`;
    const guestWord = guests === 1 ? 'guest' : 'guests';

    const body = [
      `Hi ${name}, this is a reminder from Thaiphoon Restaurant (Palo Alto).`,
      `Your reservation: ${readableDate} at ${time} for ${guests} ${guestWord}.`,
      `To cancel or reschedule: ${cancelUrl}`,
    ].join('\n');

    await client.messages.create({
      from: process.env.TWILIO_FROM_NUMBER,
      to,
      body,
    });

    await updateDoc(doc(db, 'reservations', reservationId), {
      smsSent: true,
      smsSentAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[send-sms]', error);
    return NextResponse.json({ success: false, error: 'Failed to send SMS' }, { status: 500 });
  }
}
