export const formatReadableDatePST = (isoString: string): string => {
    if (!isoString) return '';

    // Convert the ISO string to a Date object
    const date = new Date(isoString);

    // Adjust for PST by adding 8 hours if it's before 8 AM UTC
    date.setUTCHours(date.getUTCHours() + 8);

    // Convert to PST (America/Los_Angeles) and format as a readable date
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/Los_Angeles' // Ensures the correct PST conversion
    }).format(date);
}; 