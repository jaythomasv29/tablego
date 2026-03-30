import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../firebase';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const t = time.trim();
  const withColon = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (withColon) {
    let h = parseInt(withColon[1], 10);
    const m = parseInt(withColon[2], 10);
    const p = withColon[3].toUpperCase();
    if (p === 'AM' && h === 12) h = 0;
    if (p === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
}

function getDayName(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    .toLowerCase();
}

// ─── GET /api/availability/slots?date=YYYY-MM-DD ──────────────────────────────

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

    if (!hoursSnap.exists()) {
      return NextResponse.json({ slots: [] });
    }

    const businessHours = hoursSnap.data() as Record<string, {
      lunch: { open: string; close: string; isOpen: boolean; customRanges?: { start: string; end: string }[] };
      dinner: { open: string; close: string; isOpen: boolean; customRanges?: { start: string; end: string }[] };
    }>;

    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const cutoffMinutes: number = settings.reservationCutoffMinutes ?? 60;
    const timezone: string = settings.timezone ?? 'America/Los_Angeles';

    // ── Special date check ──
    const specialDates = specialSnap.docs.map(d => d.data() as { date: string; closureType?: 'full' | 'lunch' | 'dinner' });
    const specialDate = specialDates.find(sd => (sd.date ?? '').split('T')[0] === date);
    const closureType = specialDate ? (specialDate.closureType ?? 'full') : null;

    if (closureType === 'full') {
      return NextResponse.json({ slots: [], closed: true });
    }

    // ── Today cutoff ──
    const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    const isToday = date === today;
    let currentMinutes = 0;
    if (isToday) {
      const str = new Date().toLocaleTimeString('en-US', {
        timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: false,
      });
      currentMinutes = timeToMinutes(str);
    }

    const dayName = getDayName(date);
    const dayHours = businessHours[dayName];

    if (!dayHours) {
      return NextResponse.json({ slots: [], closed: true });
    }

    const slots: string[] = [];

    const addSlotsForPeriod = (
      period: typeof dayHours.lunch,
      periodClosed: boolean
    ) => {
      if (!period?.isOpen || periodClosed) return;

      const ranges = period.customRanges?.length
        ? period.customRanges.map(r => ({ start: timeToMinutes(r.start), end: timeToMinutes(r.end) }))
        : [{ start: timeToMinutes(period.open), end: timeToMinutes(period.close) }];

      for (const range of ranges) {
        let cursor = range.start;
        while (cursor < range.end) {
          // Skip slots within the cutoff window for today
          if (!isToday || cursor > currentMinutes + cutoffMinutes) {
            slots.push(minutesToLabel(cursor));
          }
          cursor += 30;
        }
      }
    };

    addSlotsForPeriod(dayHours.lunch, closureType === 'lunch');
    addSlotsForPeriod(dayHours.dinner, closureType === 'dinner');

    return NextResponse.json({ slots });
  } catch (err) {
    console.error('[availability/slots]', err);
    return NextResponse.json({ slots: [] });
  }
}
