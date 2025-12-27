// Default timezone - can be overridden by passing a specific timezone
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

export const formatReadableDatePST = (dateInput: string, timezone: string = DEFAULT_TIMEZONE): string => {
    if (!dateInput) return '';

    // If it's a YYYY-MM-DD string, parse it directly to avoid timezone issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [year, month, day] = dateInput.split('-').map(Number);
        // Create date in UTC at noon to avoid any date shifting
        const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        return new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        }).format(date);
    }

    // For other formats, convert to Date object
    const date = new Date(dateInput);
    const normalizedDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(normalizedDate);
};

// Add utility functions for consistent date handling
export const getLocalDateString = (date: Date | string | any, timeZone: string = DEFAULT_TIMEZONE): string => {
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

export const formatDateForDisplay = (date: any, timeZone: string = DEFAULT_TIMEZONE): string => {
    // If it's already a YYYY-MM-DD string, create a date at noon to avoid timezone shifts
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

export const convertDateToStorageFormat = (date: Date | string, timeZone: string = DEFAULT_TIMEZONE): string => {
    if (date instanceof Date) {
        return date.toLocaleDateString('en-CA', { timeZone });
    }

    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    return new Date(date).toLocaleDateString('en-CA', { timeZone });
};

// Get the current date in a specific timezone
export const getDateInTimezone = (date?: Date, timezone: string = DEFAULT_TIMEZONE): Date => {
    const targetDate = date || new Date();
    return new Date(
        targetDate.toLocaleString("en-US", {
            timeZone: timezone,
        })
    );
};

// Get today's date string (YYYY-MM-DD) in a specific timezone
export const getTodayInTimezone = (timezone: string = DEFAULT_TIMEZONE): string => {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
};

// Get current time in a specific timezone
export const getCurrentTimeInTimezone = (timezone: string = DEFAULT_TIMEZONE): { hours: number; minutes: number } => {
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

// Get day of week in a specific timezone
export const getDayOfWeekInTimezone = (date: Date, timezone: string = DEFAULT_TIMEZONE): string => {
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: timezone
    }).toLowerCase();
};

// Format time for display in a specific timezone
export const formatTimeInTimezone = (date: Date, timezone: string = DEFAULT_TIMEZONE): string => {
    return date.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    });
};

// Check if a date is today in a specific timezone
export const isToday = (date: Date | string, timezone: string = DEFAULT_TIMEZONE): boolean => {
    const dateString = typeof date === 'string' ? date : getLocalDateString(date, timezone);
    const todayString = getTodayInTimezone(timezone);
    return dateString === todayString;
};
