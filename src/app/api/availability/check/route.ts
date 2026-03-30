import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../firebase';
import { doc, getDoc, getDocs, collection } from 'firebase/firestore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse "7:00 PM" or "17:00" → minutes since midnight */
function timeToMinutes(time: string): number {
  const ampm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    const period = ampm[3].toUpperCase();
    if (period === 'AM' && h === 12) h = 0;
    if (period === 'PM' && h !== 12) h += 12;
    return h * 60 + m;
  }
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** YYYY-MM-DD → lowercase day name e.g. "monday" */
function getDayName(dateStr: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    .toLowerCase();
}

/** Current time in minutes in business timezone */
function nowMinutes(timezone: string): number {
  const str = new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
  return timeToMinutes(str);
}

/** Today's date string (YYYY-MM-DD) in business timezone */
function todayString(timezone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

// ─── GET /api/availability/check?date=YYYY-MM-DD&time=7:00+PM ────────────────

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  const time = request.nextUrl.searchParams.get('time');

  if (!date || !time) {
    return NextResponse.json({ error: 'Missing date or time' }, { status: 400 });
  }

  try {
    const [hoursSnap, settingsSnap, specialSnap] = await Promise.all([
      getDoc(doc(db, 'settings', 'businessHours')),
      getDoc(doc(db, 'settings', 'general')),
      getDocs(collection(db, 'specialDates')),
    ]);

    // If no hours configured, fail open
    if (!hoursSnap.exists()) {
      return NextResponse.json({ available: true });
    }

    const businessHours = hoursSnap.data() as Record<string, {
      lunch: { open: string; close: string; isOpen: boolean; customRanges?: { start: string; end: string }[] };
      dinner: { open: string; close: string; isOpen: boolean; customRanges?: { start: string; end: string }[] };
    }>;

    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const cutoffMinutes: number = settings.reservationCutoffMinutes ?? 60;
    const timezone: string = settings.timezone ?? 'America/Los_Angeles';

    // ── Special date check ──
    const specialDates = specialSnap.docs.map(d => d.data() as { date: string; reason?: string; closureType?: 'full' | 'lunch' | 'dinner' });
    const specialDate = specialDates.find(sd => {
      const sdDate = typeof sd.date === 'string' ? sd.date.split('T')[0] : '';
      return sdDate === date;
    });

    const closureType = specialDate ? (specialDate.closureType ?? 'full') : null;

    if (closureType === 'full') {
      const reason = specialDate?.reason
        ? `We're closed on this day (${specialDate.reason}).`
        : "We're closed on this day.";
      return NextResponse.json({ available: false, reason });
    }

    // ── Day hours check ──
    const dayName = getDayName(date);
    const dayHours = businessHours[dayName];

    if (!dayHours) {
      return NextResponse.json({ available: false, reason: `We're not open on ${dayName}s.` });
    }

    const isToday = date === todayString(timezone);
    const currentMinutes = isToday ? nowMinutes(timezone) : 0;
    const requestedMinutes = timeToMinutes(time);

    // Check if requested time falls within a period's window
    const checkPeriod = (
      period: typeof dayHours.lunch,
      periodClosed: boolean
    ): { ok: boolean; reason?: string } => {
      if (!period?.isOpen || periodClosed) return { ok: false };

      const ranges = period.customRanges?.length
        ? period.customRanges.map(r => ({ start: timeToMinutes(r.start), end: timeToMinutes(r.end) }))
        : [{ start: timeToMinutes(period.open), end: timeToMinutes(period.close) }];

      for (const range of ranges) {
        if (requestedMinutes >= range.start && requestedMinutes < range.end) {
          if (isToday && requestedMinutes <= currentMinutes + cutoffMinutes) {
            const h = Math.floor(cutoffMinutes / 60);
            const m = cutoffMinutes % 60;
            const cutoffStr = h > 0
              ? (m > 0 ? `${h}h ${m}m` : `${h} hour${h !== 1 ? 's' : ''}`)
              : `${m} minutes`;
            return { ok: false, reason: `Reservations must be made at least ${cutoffStr} in advance.` };
          }
          return { ok: true };
        }
      }
      return { ok: false };
    };

    const lunchResult = checkPeriod(dayHours.lunch, closureType === 'lunch');
    const dinnerResult = checkPeriod(dayHours.dinner, closureType === 'dinner');

    if (lunchResult.ok || dinnerResult.ok) {
      return NextResponse.json({ available: true });
    }

    // Return a specific reason if cutoff was the issue
    if (lunchResult.reason) return NextResponse.json({ available: false, reason: lunchResult.reason });
    if (dinnerResult.reason) return NextResponse.json({ available: false, reason: dinnerResult.reason });

    // Build a helpful open-hours message
    const openPeriods: string[] = [];
    if (dayHours.lunch?.isOpen && closureType !== 'lunch') {
      openPeriods.push(`lunch (${dayHours.lunch.open}–${dayHours.lunch.close})`);
    }
    if (dayHours.dinner?.isOpen && closureType !== 'dinner') {
      openPeriods.push(`dinner (${dayHours.dinner.open}–${dayHours.dinner.close})`);
    }

    if (openPeriods.length === 0) {
      return NextResponse.json({ available: false, reason: `We're closed on ${dayName}s.` });
    }

    return NextResponse.json({
      available: false,
      reason: `That time isn't available. We're open for ${openPeriods.join(' and ')} on ${dayName}s.`,
    });
  } catch (err) {
    console.error('[availability/check]', err);
    // Fail open — don't block reservations if the check errors
    return NextResponse.json({ available: true });
  }
}
