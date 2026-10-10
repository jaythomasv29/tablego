const DEFAULT_TIMEZONE = 'America/Los_Angeles';
function dateOnly(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function instant(value: unknown): Date {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !dateOnly(value)) throw new RangeError('Invalid calendar date');
    let date: Date;
    if (value instanceof Date) date = value;
    else if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') date = value.toDate();
    else if (typeof value === 'string' && value.trim()) date = new Date(value);
    else throw new RangeError('A valid date is required');
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new RangeError('Invalid date');
    return date;
}
export const getLocalDateString = (value: unknown, timeZone = DEFAULT_TIMEZONE): string => {
    if (dateOnly(value)) return value;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant(value));
    const get = (type: string) => parts.find(part => part.type === type)!.value;
    return `${get('year')}-${get('month')}-${get('day')}`;
};
function displayDate(value: unknown, timeZone: string, weekday = false): string {
    const calendar = dateOnly(value);
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric',
        ...(weekday ? { weekday: 'long' as const } : {}), timeZone: calendar ? 'UTC' : timeZone }).format(calendar ? new Date(`${value}T12:00:00Z`) : instant(value));
}
export const formatReadableDatePST = (value: string, timeZone = DEFAULT_TIMEZONE): string => displayDate(value, timeZone, true);
export const formatDateForDisplay = (value: unknown, timeZone = DEFAULT_TIMEZONE): string => displayDate(value, timeZone);
export const convertDateToStorageFormat = (value: Date | string, timeZone = DEFAULT_TIMEZONE): string => getLocalDateString(value, timeZone);
// A calendar widget needs local Date components representing the restaurant clock.
// Never use this synthetic Date as an instant or shift a user-selected calendar day.
export const getDateInTimezone = (date = new Date(), timeZone = DEFAULT_TIMEZONE): Date => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant(date));
    const get = (type: string) => Number(parts.find(part => part.type === type)!.value);
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
};
export const getTodayInTimezone = (timeZone = DEFAULT_TIMEZONE): string => getLocalDateString(new Date(), timeZone);
export const getCurrentTimeInTimezone = (timeZone = DEFAULT_TIMEZONE): { hours: number; minutes: number } => {
    const date = getDateInTimezone(new Date(), timeZone);
    return { hours: date.getHours(), minutes: date.getMinutes() };
};
export const getDayOfWeekInTimezone = (date: Date, timeZone = DEFAULT_TIMEZONE): string => instant(date).toLocaleDateString('en-US', { weekday: 'long', timeZone }).toLowerCase();
export const formatTimeInTimezone = (date: Date, timeZone = DEFAULT_TIMEZONE): string => instant(date).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true });
export const isToday = (date: Date | string, timeZone = DEFAULT_TIMEZONE): boolean => getLocalDateString(date, timeZone) === getTodayInTimezone(timeZone);
