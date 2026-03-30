import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../firebase';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

// GET /api/availability/settings?date=YYYY-MM-DD
// Returns raw business hours, cutoff, and special date closure for a given date.
// ai-chat-widget uses this to generate time slots itself.
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  if (!date) {
    return NextResponse.json({ error: 'Missing date' }, { status: 400 });
  }

  try {
    const [hoursSnap, settingsSnap, specialSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'businessHours')),
      getDoc(doc(db, 'settings', 'general')),
      getDocs(collection(db, 'specialDates')),
    ]);

    const businessHours = hoursSnap.exists() ? hoursSnap.data() : null;
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};

    const specialDates = specialSnap.docs.map(d => d.data() as { date: string; reason?: string; closureType?: 'full' | 'lunch' | 'dinner' });
    const specialDate = specialDates.find(sd => (sd.date ?? '').split('T')[0] === date);

    return NextResponse.json({
      businessHours,
      cutoffMinutes: settings.reservationCutoffMinutes ?? 60,
      timezone: settings.timezone ?? 'America/Los_Angeles',
      specialDate: specialDate ?? null,
    });
  } catch (err) {
    console.error('[availability/settings]', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}
