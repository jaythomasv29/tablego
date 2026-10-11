'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { getLocalDateString as businessDate } from '@/utils/dateUtils';
import { restaurantIdentity, defaultRestaurant, type RestaurantIdentity } from '@/lib/restaurant/config';
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
    restaurant: RestaurantIdentity;
    loading: boolean;
    error: string | null;
    refreshTimezone: () => Promise<void>;
}

const TimezoneContext = createContext<TimezoneContextType>({
    timezone: 'America/Los_Angeles', // Used only while loading; availability fails closed.
    restaurant: defaultRestaurant,
    loading: true,
    error: null,
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
    const [restaurant, setRestaurant] = useState<RestaurantIdentity>(defaultRestaurant);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const applySettings = (data: Record<string, unknown> | undefined) => {
        if (!data || typeof data.timezone !== 'string') throw new Error('Missing business timezone');
        new Intl.DateTimeFormat('en-US', { timeZone: data.timezone }).format();
        setTimezone(data.timezone);
        setRestaurant(restaurantIdentity(data.restaurant));
        setError(null);
        setLoading(false);
    };
    const settingsError = () => {
        setError('Business settings could not be loaded. Please refresh or check settings.');
        setLoading(false);
    };
    const fetchTimezone = async () => {
        try { applySettings((await getDoc(doc(db, 'settings', 'general'))).data()); }
        catch { settingsError(); }
    };
    useEffect(() => onSnapshot(doc(db, 'settings', 'general'), snapshot => {
        try { applySettings(snapshot.data()); } catch { settingsError(); }
    }, settingsError), []);

    const refreshTimezone = async () => {
        setLoading(true);
        await fetchTimezone();
    };

    return (
        <TimezoneContext.Provider value={{ timezone, restaurant, loading, error, refreshTimezone }}>
            {children}
        </TimezoneContext.Provider>
    );
}

// Share the same calendar/instant rules throughout the application.
export { getDateInTimezone, getLocalDateString, getCurrentTimeInTimezone, getTodayInTimezone, getDayOfWeekInTimezone } from '@/utils/dateUtils';
export const formatDateInTimezone = (date: Date | string, timezone: string, options?: Intl.DateTimeFormatOptions): string => {
    const calendar = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date);
    businessDate(date, timezone); // Validate calendar dates and require offsets on timestamp strings.
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: calendar ? 'UTC' : timezone }).format(calendar ? new Date(`${date}T12:00:00Z`) : new Date(date));
};
