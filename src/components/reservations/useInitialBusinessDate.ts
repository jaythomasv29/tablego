'use client';
import { useEffect, useState } from 'react';
import { getDateInTimezone } from '@/utils/dateUtils';
// Initialize once after configuration is valid. Later live setting updates must
// preserve a guest's literal calendar selection and completed receipt.
export function useInitialBusinessDate(timezone: string, loading: boolean, error: string | null) {
  const [date, setDate] = useState<Date | null>(null);
  useEffect(() => {
    if (!loading && !error) setDate(previous => previous || getDateInTimezone(new Date(), timezone));
  }, [timezone, loading, error]);
  return date;
}
