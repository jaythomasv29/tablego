import { NextRequest, NextResponse } from 'next/server';
import { loadPolicy } from '@/lib/reservations/policy';
import { checkAvailability, validDate, timeMinutes } from '@/lib/reservations/availability';
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date'), time = request.nextUrl.searchParams.get('time');
  if (!validDate(date) || timeMinutes(time) === null) return NextResponse.json({ error: 'Invalid date or time', available: false }, { status: 400 });
  try { return NextResponse.json(checkAvailability(date, time!, await loadPolicy()), { headers: { 'Cache-Control': 'no-store' } }); }
  catch { return NextResponse.json({ outcome: 'unable-to-verify', available: false, reason: 'Unable to verify availability. Please try again or call the restaurant.' }, { status: 503 }); }
}
