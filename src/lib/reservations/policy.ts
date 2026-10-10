import { getServerDatabase } from '../serverFirebase';
import type { AvailabilityPolicy } from './availability';
import type { Transaction } from 'firebase-admin/firestore';
export async function loadPolicy(transaction?: Transaction): Promise<AvailabilityPolicy> {
  const db = getServerDatabase();
  const [hours, general, special] = transaction
    ? await Promise.all([transaction.get(db.doc('settings/businessHours')), transaction.get(db.doc('settings/general')), transaction.get(db.collection('specialDates'))])
    : await Promise.all([db.doc('settings/businessHours').get(), db.doc('settings/general').get(), db.collection('specialDates').get()]);
  if (!hours.exists || !general.exists) throw new Error('Availability configuration is missing');
  const settings = general.data()!;
  return { businessHours: hours.data() as AvailabilityPolicy['businessHours'], specialDates: special.docs.map(d => d.data()) as AvailabilityPolicy['specialDates'],
    timezone: settings.timezone || 'America/Los_Angeles', cutoffMinutes: settings.reservationCutoffMinutes ?? 60, leadTimeMinutes: settings.minimumLeadTimeMinutes ?? 50 };
}
