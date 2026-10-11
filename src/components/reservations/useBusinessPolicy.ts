'use client';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useTimezone } from '@/contexts/TimezoneContext';
import type { AvailabilityPolicy } from '@/lib/reservations/availability';
export function useBusinessPolicy() {
  const { timezone, loading: settingsLoading, error: settingsError } = useTimezone();
  const [businessHours, setBusinessHours] = useState<AvailabilityPolicy['businessHours'] | null>(null);
  const [specialDates, setSpecialDates] = useState<AvailabilityPolicy['specialDates']>([]);
  const [cutoffMinutes, setCutoffMinutes] = useState(60), [leadTimeMinutes, setLeadTimeMinutes] = useState(50);
  const [ready, setReady] = useState({ hours: false, dates: false, policy: false }), [error, setError] = useState('');
  useEffect(() => {
    const failed = () => setError('Booking settings could not be loaded. Please refresh or call the restaurant.');
    const unsubs = [
      onSnapshot(doc(db, 'settings', 'businessHours'), snapshot => {
        if (!snapshot.exists()) { failed(); setBusinessHours(null); return; }
        setBusinessHours(snapshot.data() as AvailabilityPolicy['businessHours']); setReady(previous => ({ ...previous, hours: true }));
      }, failed),
      onSnapshot(collection(db, 'specialDates'), snapshot => { setSpecialDates(snapshot.docs.map(doc => doc.data() as AvailabilityPolicy['specialDates'][number])); setReady(previous => ({ ...previous, dates: true })); }, failed),
      onSnapshot(doc(db, 'settings', 'general'), snapshot => {
        const data = snapshot.data();
        if (!data || [data.reservationCutoffMinutes ?? 60, data.minimumLeadTimeMinutes ?? 50].some(value => !Number.isInteger(value) || value < 0 || value > 1440)) { failed(); return; }
        setCutoffMinutes(data.reservationCutoffMinutes ?? 60); setLeadTimeMinutes(data.minimumLeadTimeMinutes ?? 50); setReady(previous => ({ ...previous, policy: true }));
      }, failed),
    ];
    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, []);
  const loading = settingsLoading || !ready.hours || !ready.dates || !ready.policy;
  const policy = useMemo(() => !loading && !error && !settingsError && businessHours ? { businessHours, specialDates, cutoffMinutes, leadTimeMinutes, timezone } : null, [loading, error, settingsError, businessHours, specialDates, cutoffMinutes, leadTimeMinutes, timezone]);
  return { businessHours, specialDates, cutoffMinutes, leadTimeMinutes, loading, error: error || settingsError,
    policy };
}
