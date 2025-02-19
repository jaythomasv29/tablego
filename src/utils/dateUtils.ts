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