'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';

// Common timezone options for restaurants
export const TIMEZONE_OPTIONS = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
    { value: 'America/Phoenix', label: 'Arizona Time (No DST)' },
    { value: 'America/Puerto_Rico', label: 'Atlantic Time (AT)' },
    { value: 'Europe/London', label: 'London (GMT/BST)' },
    { value: 'Europe/Paris', label: 'Central European Time (CET)' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST)' },
    { value: 'Asia/Shanghai', label: 'China Standard Time (CST)' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET)' },
];

interface TimezoneContextType {
    timezone: string;
    loading: boolean;
    refreshTimezone: () => Promise<void>;
}

const TimezoneContext = createContext<TimezoneContextType>({
    timezone: 'America/Los_Angeles', // Default fallback
    loading: true,
    refreshTimezone: async () => {},
});

export const useTimezone = () => {
    const context = useContext(TimezoneContext);
    if (!context) {
        throw new Error('useTimezone must be used within a TimezoneProvider');
    }
    return context;
};

interface TimezoneProviderProps {
    children: ReactNode;
}

export function TimezoneProvider({ children }: TimezoneProviderProps) {
    const [timezone, setTimezone] = useState<string>('America/Los_Angeles');
    const [loading, setLoading] = useState(true);

    const fetchTimezone = async () => {
        try {
            const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
            if (settingsDoc.exists()) {
                const data = settingsDoc.data();
                if (data.timezone) {
                    setTimezone(data.timezone);
                }
            }
        } catch (error) {
            console.error('Error fetching timezone setting:', error);
            // Keep default timezone on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTimezone();
    }, []);

    const refreshTimezone = async () => {
        setLoading(true);
        await fetchTimezone();
    };

    return (
        <TimezoneContext.Provider value={{ timezone, loading, refreshTimezone }}>
            {children}
        </TimezoneContext.Provider>
    );
}

// Share the same calendar/instant rules throughout the application.
export { getDateInTimezone, getLocalDateString, getCurrentTimeInTimezone, getTodayInTimezone, getDayOfWeekInTimezone } from '@/utils/dateUtils';
export const formatDateInTimezone = (date: Date | string, timezone: string, options?: Intl.DateTimeFormatOptions): string => {
    const calendar = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: calendar ? 'UTC' : timezone }).format(calendar ? new Date(`${date}T12:00:00Z`) : new Date(date));
};
