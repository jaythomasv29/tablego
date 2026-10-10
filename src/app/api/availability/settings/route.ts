import { NextRequest, NextResponse } from 'next/server';
import { loadPolicy } from '@/lib/reservations/policy';
import { slotsForDate, validDate } from '@/lib/reservations/availability';
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  if (!validDate(date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  try {
    const policy = await loadPolicy(), closures = policy.specialDates.filter(s => s.date.split('T')[0] === date);
    const full = closures.some(s => !s.closureType || s.closureType === 'full') || (closures.some(s => s.closureType === 'lunch') && closures.some(s => s.closureType === 'dinner'));
    return NextResponse.json({ ...policy, slots: slotsForDate(date, policy), capacityPolicy: 'hours-only', specialDate: full ? { date, closureType: 'full' } : closures[0] || null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Unable to verify availability', outcome: 'unable-to-verify' }, { status: 503 }); }
}
