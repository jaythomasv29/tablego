'use client';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useTimezone } from '@/contexts/TimezoneContext';
import { serviceReservation, type ServiceReservation } from '@/lib/reservations/service';
export function useReservations() {
  const { timezone, loading: timezoneLoading, error: timezoneError } = useTimezone();
  const [bookings, setBookings] = useState<ServiceReservation[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    if (timezoneLoading || timezoneError) return;
    setLoading(true); setError('');
    return onSnapshot(collection(db, 'reservations'), snapshot => {
      setBookings(snapshot.docs.map(doc => serviceReservation(doc.id, doc.data(), timezone))); setLoading(false);
    }, () => { setError('Unable to load reservations. Check your connection or sign in again.'); setLoading(false); });
  }, [timezone, timezoneLoading, timezoneError]);
  return { bookings, timezone, loading: loading || timezoneLoading, error: timezoneError || error };
}
