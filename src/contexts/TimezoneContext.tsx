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

// Utility functions that use a specific timezone
export const getDateInTimezone = (date?: Date, timezone?: string): Date => {
    const targetDate = date || new Date();
    const tz = timezone || 'America/Los_Angeles';
    return new Date(
        targetDate.toLocaleString("en-US", {
            timeZone: tz,
        })
    );
};

export const formatDateInTimezone = (
    date: Date | string,
    timezone: string,
    options?: Intl.DateTimeFormatOptions
): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-US', {
        ...options,
        timeZone: timezone,
    });
};

export const getLocalDateString = (
    date: Date | string | any,
    timezone: string
): string => {
    // If it's already a YYYY-MM-DD string, return it directly
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    // If it's a full ISO string, extract the date part and convert to local timezone
    if (typeof date === 'string') {
        const d = new Date(date);
        return d.toLocaleDateString('en-CA', { timeZone: timezone });
    }

    // If it's a Date object
    if (date instanceof Date) {
        return date.toLocaleDateString('en-CA', { timeZone: timezone });
    }

    // If it's a Firestore Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
        return date.toDate().toLocaleDateString('en-CA', { timeZone: timezone });
    }

    // Fallback
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
};

export const getCurrentTimeInTimezone = (timezone: string): { hours: number; minutes: number } => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    };
    const timeString = now.toLocaleTimeString('en-US', options);
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
};

export const getTodayInTimezone = (timezone: string): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
};

export const getDayOfWeekInTimezone = (date: Date, timezone: string): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: timezone
    }).toLowerCase();
};

