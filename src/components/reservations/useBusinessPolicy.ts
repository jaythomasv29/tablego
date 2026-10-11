'use client';
import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useTimezone } from '@/contexts/TimezoneContext';
import { automaticConfirmation } from '@/lib/reservations/domain';
import type { AvailabilityPolicy } from '@/lib/reservations/availability';
export function useBusinessPolicy() {
  const { timezone, loading: settingsLoading, error: settingsError } = useTimezone();
  const [businessHours, setBusinessHours] = useState<AvailabilityPolicy['businessHours'] | null>(null);
  const [specialDates, setSpecialDates] = useState<AvailabilityPolicy['specialDates']>([]);
  const [cutoffMinutes, setCutoffMinutes] = useState(60), [leadTimeMinutes, setLeadTimeMinutes] = useState(50);
  const [autoConfirmReservations, setAutoConfirmReservations] = useState(true);
  const [ready, setReady] = useState({ hours: false, dates: false, policy: false }), [error, setError] = useState('');
  useEffect(() => {
    const health = { hours: false, dates: false, policy: false };
    const failed = (source: keyof typeof health) => { health[source] = false; setReady(previous => ({ ...previous, [source]: false })); setError('Booking settings could not be loaded. Please refresh or call the restaurant.'); };
    const recovered = (source: keyof typeof health) => { health[source] = true; setReady(previous => ({ ...previous, [source]: true })); if (Object.values(health).every(Boolean)) setError(''); };
    const unsubs = [
      onSnapshot(doc(db, 'settings', 'businessHours'), snapshot => {
        if (!snapshot.exists()) { failed('hours'); setBusinessHours(null); return; }
        setBusinessHours(snapshot.data() as AvailabilityPolicy['businessHours']); recovered('hours');
      }, () => failed('hours')),
      onSnapshot(collection(db, 'specialDates'), snapshot => { setSpecialDates(snapshot.docs.map(doc => doc.data() as AvailabilityPolicy['specialDates'][number])); recovered('dates'); }, () => failed('dates')),
      onSnapshot(doc(db, 'settings', 'general'), snapshot => {
        const data = snapshot.data();
        if (!data || [data.reservationCutoffMinutes ?? 60, data.minimumLeadTimeMinutes ?? 50].some(value => !Number.isInteger(value) || value < 0 || value > 1440)) { failed('policy'); return; }
        try { setAutoConfirmReservations(automaticConfirmation(data.autoConfirmReservations)); } catch { failed('policy'); return; }
        setCutoffMinutes(data.reservationCutoffMinutes ?? 60); setLeadTimeMinutes(data.minimumLeadTimeMinutes ?? 50); recovered('policy');
      }, () => failed('policy')),
    ];
    return () => unsubs.forEach(unsubscribe => unsubscribe());
  }, []);
  const loading = settingsLoading || !ready.hours || !ready.dates || !ready.policy;
  const policy = useMemo(() => !loading && !error && !settingsError && businessHours ? { businessHours, specialDates, cutoffMinutes, leadTimeMinutes, timezone, autoConfirmReservations } : null, [loading, error, settingsError, businessHours, specialDates, cutoffMinutes, leadTimeMinutes, timezone, autoConfirmReservations]);
  return { businessHours, specialDates, cutoffMinutes, leadTimeMinutes, loading, error: error || settingsError,
    policy };
}
