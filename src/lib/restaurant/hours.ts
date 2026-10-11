import { timeMinutes, type PeriodHours } from '../reservations/availability.ts';
export function validateHours(value: unknown): Record<string, { lunch: PeriodHours; dinner: PeriodHours }> {
  const result: Record<string, { lunch: PeriodHours; dinner: PeriodHours }> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Business hours are required');
  const input = value as Record<string, Record<string, PeriodHours>>;
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (Object.keys(input).some(key => !days.includes(key))) throw new Error('Unknown business day');
  for (const day of days) {
    result[day] = {} as { lunch: PeriodHours; dinner: PeriodHours };
    for (const period of ['lunch', 'dinner'] as const) {
      const data = input[day]?.[period];
      if (!data || typeof data.isOpen !== 'boolean' || typeof data.open !== 'string' || typeof data.close !== 'string') throw new Error(`Complete hours are required for ${day} ${period}`);
      if (Object.keys(data).some(key => !['open', 'close', 'isOpen', 'customRanges'].includes(key))) throw new Error('Unknown hours setting');
      if (data.customRanges !== undefined && (!Array.isArray(data.customRanges) || data.customRanges.length > 10)) throw new Error('At most 10 custom ranges are supported');
      const ranges = data.customRanges?.length ? data.customRanges : [{ start: data.open, end: data.close }];
      for (const range of ranges) {
        const start = timeMinutes(range.start), end = timeMinutes(range.end);
        if (start === null || end === null || end <= start) throw new Error(`${day} ${period}: use valid same-day opening and closing times`);
      }
      result[day][period] = { open: data.open, close: data.close, isOpen: data.isOpen, ...(data.customRanges ? { customRanges: data.customRanges.map(range => ({ start: range.start, end: range.end })) } : {}) };
    }
  }
  return result;
}
