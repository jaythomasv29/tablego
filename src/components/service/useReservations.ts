'use client';
import { useEffect, useRef, useState } from 'react';
import { newReservationIds } from '@/lib/reservations/alerts';
import { playNotificationSound } from '@/utils/soundUtils';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import { useTimezone } from '@/contexts/TimezoneContext';
import { serviceReservation, type ServiceReservation } from '@/lib/reservations/service';
export function useReservations({ alerts = false }: { alerts?: boolean } = {}) {
  const seen = useRef<Set<string> | null>(null);
  const { timezone, loading: timezoneLoading, error: timezoneError } = useTimezone();
  const [bookings, setBookings] = useState<ServiceReservation[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => {
    if (timezoneLoading || timezoneError) return;
    setLoading(true); setError('');
    return onSnapshot(collection(db, 'reservations'), snapshot => {
      const incoming = snapshot.docs.map(doc => serviceReservation(doc.id, doc.data(), timezone));
      if (!snapshot.metadata.fromCache) {
        const fresh = newReservationIds(seen.current, incoming);
        seen.current = new Set([...Array.from(seen.current || []), ...incoming.map(booking => booking.id)]);
        if (alerts && fresh.length) playNotificationSound();
      }
      setBookings(incoming); setLoading(false);
    }, () => { setError('Unable to load reservations. Check your connection or sign in again.'); setLoading(false); });
  }, [timezone, timezoneLoading, timezoneError, alerts]);
  return { bookings, timezone, loading: loading || timezoneLoading, error: timezoneError || error };
}
