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

// Get today's date string (YYYY-MM-DD) in a specific timezone, optionally offset by a number of days
export const getTodayInTimezone = (timezone: string = DEFAULT_TIMEZONE, dayOffset: number = 0): string => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
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

// Convert a stored "YYYY-MM-DD" date + "h:mm AM/PM" time (wall-clock in the
// restaurant's timezone) into the actual UTC instant it represents.
export const getReservationDateTime = (dateStr: string, timeStr: string, timezone: string = DEFAULT_TIMEZONE): Date => {
    const [, rawHour, rawMinute, meridiem] = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i) || [];
    let hour = parseInt(rawHour || '0', 10);
    const minute = parseInt(rawMinute || '0', 10);
    if (meridiem?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (meridiem?.toUpperCase() === 'AM' && hour === 12) hour = 0;

    const [year, month, day] = dateStr.split('-').map(Number);

    // First guess: treat the wall-clock time as if it were UTC.
    const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

    // Find what that UTC instant looks like in the target timezone, then
    // adjust by the difference to land on the correct UTC instant.
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
    }).formatToParts(guess).reduce((acc, part) => {
        acc[part.type] = part.value;
        return acc;
    }, {} as Record<string, string>);

    const tzAsUtc = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour) === 24 ? 0 : Number(parts.hour), Number(parts.minute), Number(parts.second)
    );

    const offset = guess.getTime() - tzAsUtc;
    return new Date(guess.getTime() + offset);
};
