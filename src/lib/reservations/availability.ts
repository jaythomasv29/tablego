export interface PeriodHours { open: string; close: string; isOpen: boolean; customRanges?: { start: string; end: string }[] }
export interface AvailabilityPolicy {
  businessHours: Record<string, { lunch: PeriodHours; dinner: PeriodHours }>;
  specialDates: { date: string; closureType?: 'full' | 'lunch' | 'dinner'; reason?: string }[];
  timezone: string; cutoffMinutes: number; leadTimeMinutes: number;
}
export interface BookingSlot { time: string; period: 'lunch' | 'dinner' }
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function timeMinutes(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  let h = Number(match[1]); const m = Number(match[2] || 0), meridiem = match[3]?.toUpperCase();
  if (m > 59 || (meridiem ? h < 1 || h > 12 : h > 23 || match[2] === undefined)) return null;
  if (meridiem) h = h % 12 + (meridiem === 'PM' ? 12 : 0);
  return h * 60 + m;
}
export function displayTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}
export function restaurantClock(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) + Number(get('second')) / 60 };
}
export function calendarDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function slotsForDate(date: string, policy: AvailabilityPolicy, now = new Date()): BookingSlot[] {
  if (!validDate(date)) throw new Error('Invalid calendar date');
  if (!policy.businessHours || !Number.isFinite(policy.cutoffMinutes) || policy.cutoffMinutes < 0 || policy.cutoffMinutes > 1440 ||
      !Number.isFinite(policy.leadTimeMinutes) || policy.leadTimeMinutes < 0 || policy.leadTimeMinutes > 1440) throw new Error('Invalid availability configuration');
  const clock = restaurantClock(policy.timezone, now);
  if (date < clock.date) return [];
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
  const hours = policy.businessHours[day];
  if (!hours) throw new Error('Missing business hours');
  const closures = policy.specialDates.filter(s => s.date?.split('T')[0] === date);
  if (closures.some(s => !s.closureType || s.closureType === 'full')) return [];
  const slots: BookingSlot[] = [];
  for (const period of ['lunch', 'dinner'] as const) {
    const config = hours[period];
    if (!config || typeof config.isOpen !== 'boolean') throw new Error('Invalid business hours');
    if (!config.isOpen || closures.some(s => s.closureType === period)) continue;
    const ranges = config.customRanges?.length ? config.customRanges : [{ start: config.open, end: config.close }];
    for (const range of ranges) {
      const start = timeMinutes(range.start), end = timeMinutes(range.end);
      if (start === null || end === null || end <= start) throw new Error('Invalid hours; overnight ranges are not supported');
      for (let minute = start; minute < end && minute <= end - policy.cutoffMinutes; minute += 30) {
        if (date === clock.date && minute < clock.minutes + policy.leadTimeMinutes) continue;
        if (!slots.some(slot => timeMinutes(slot.time) === minute)) slots.push({ time: displayTime(minute), period });
      }
    }
  }
  return slots.sort((a, b) => timeMinutes(a.time)! - timeMinutes(b.time)!);
}
export function checkAvailability(date: string, time: string, policy: AvailabilityPolicy, now = new Date()) {
  const minutes = timeMinutes(time);
  if (!validDate(date) || minutes === null) return { available: false, outcome: 'unavailable', reason: 'Enter a valid date and time.' } as const;
  const available = slotsForDate(date, policy, now).some(slot => timeMinutes(slot.time) === minutes);
  return { available, outcome: available ? 'available' : 'unavailable', reason: available ? undefined : 'This time is outside our available booking hours. Please choose another time.' };
}
