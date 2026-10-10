import { requireAdmin } from '@/lib/auth/admin';
import { loadPolicy } from '@/lib/reservations/policy';
import { slotsForDate, restaurantClock } from '@/lib/reservations/availability';
import { createReservation } from '@/lib/reservations/repository';
import { getServerDatabase } from '@/lib/serverFirebase';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
import { randomUUID } from 'node:crypto';
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  if (process.env.TABLEGO_ENVIRONMENT !== 'staging') return privateJson({ error: 'Test reservations are restricted to staging' }, 403);
  try {
    const { email } = await request.json();
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new ReservationError('Invalid email');
    const policy = await loadPolicy();
    let date = '', time = '';
    for (let offset = 1; offset <= 14; offset++) {
      date = restaurantClock(policy.timezone, new Date(Date.now() + offset * 86400000)).date;
      time = slotsForDate(date, policy)[0]?.time || '';
      if (time) break;
    }
    if (!time) throw new ReservationError('No test time available in the next two weeks', 409);
    const result = await createReservation({ name: 'Synthetic Email Test', email, phone: '+16505550192', date, time, guests: 2, comments: 'Synthetic staging fixture' }, false, false, randomUUID());
    await getServerDatabase().doc(`reservations/${result.reservationId}`).update({ isTest: true });
    return privateJson(result);
  } catch (error) { return reservationError(error); }
}
