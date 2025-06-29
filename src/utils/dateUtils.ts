export const formatReadableDatePST = (isoString: string): string => {
    if (!isoString) return '';

    // Convert the ISO string to a Date object
    const date = new Date(isoString);

    // Normalize to UTC midnight to ensure consistency across different times of the same day
    const normalizedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    // Format the date in UTC without shifting
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC' // Ensure it stays in UTC
    }).format(normalizedDate);
};

// Add utility functions for consistent date handling
export const getLocalDateString = (date: Date | string | any, timeZone = 'America/Los_Angeles'): string => {
    // If it's already a YYYY-MM-DD string, return it directly
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    // If it's a full ISO string, extract the date part and convert to local timezone
    if (typeof date === 'string') {
        const d = new Date(date);
        return d.toLocaleDateString('en-CA', { timeZone });
    }

    // If it's a Date object
    if (date instanceof Date) {
        return date.toLocaleDateString('en-CA', { timeZone });
    }

    // If it's a Firestore Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
        return date.toDate().toLocaleDateString('en-CA', { timeZone });
    }

    // Fallback
    return new Date().toLocaleDateString('en-CA', { timeZone });
};

export const formatDateForDisplay = (date: any, timeZone = 'America/Los_Angeles'): string => {
    // If it's already a YYYY-MM-DD string, create a date at noon PST to avoid timezone shifts
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const d = new Date(date + 'T12:00:00');
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone
        });
    }

    // If it's a Firestore Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
        return date.toDate().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone
        });
    }

    // If it's a string (ISO format)
    if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone
        });
    }

    // If it's already a Date object
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone
    });
};

export const convertDateToStorageFormat = (date: Date | string, timeZone = 'America/Los_Angeles'): string => {
    if (date instanceof Date) {
        return date.toLocaleDateString('en-CA', { timeZone });
    }

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    return new Date(date).toLocaleDateString('en-CA', { timeZone });
}; 