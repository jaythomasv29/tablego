import { getServerDatabase } from '../serverFirebase';
import type { AvailabilityPolicy } from './availability';
export async function loadPolicy(): Promise<AvailabilityPolicy> {
  const db = getServerDatabase();
  const [hours, general, special] = await Promise.all([db.doc('settings/businessHours').get(), db.doc('settings/general').get(), db.collection('specialDates').get()]);
  if (!hours.exists || !general.exists) throw new Error('Availability configuration is missing');
  const settings = general.data()!;
  return { businessHours: hours.data() as AvailabilityPolicy['businessHours'], specialDates: special.docs.map(d => d.data()) as AvailabilityPolicy['specialDates'],
    timezone: settings.timezone || 'America/Los_Angeles', cutoffMinutes: settings.reservationCutoffMinutes ?? 60, leadTimeMinutes: settings.minimumLeadTimeMinutes ?? 50 };
}
