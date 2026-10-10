import { validDate, timeMinutes, displayTime } from './availability';
export interface BookingInput { name: string; email: string; phone: string; date: string; time: string; guests: number; comments: string }
export function normalizedPhone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 40 || /[^\d+\s().-]/.test(value)) throw new Error('Enter a valid US phone number');
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') digits = digits.slice(1);
  if (digits.length !== 10) throw new Error('Enter a valid US phone number');
  return `+1${digits}`;
}
export function bookingInput(value: unknown): BookingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Reservation details are required');
  const data = value as Record<string, unknown>;
  const text = (key: string, max: number, required = true) => {
    if (!required && data[key] === undefined) return '';
    if (typeof data[key] !== 'string' || data[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data[key])) throw new Error(`Invalid ${key}`);
    const result = data[key].trim();
    if (required && !result) throw new Error(`${key} is required`);
    return result;
  };
  const date = text('date', 10), time = timeMinutes(text('time', 15));
  if (!validDate(date) || time === null) throw new Error('Invalid date or time');
  if (!Number.isInteger(data.guests) || Number(data.guests) < 1 || Number(data.guests) > 20) throw new Error('Party size must be between 1 and 20');
  const email = text('email', 254).toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error('Enter a valid email address');
  return { name: text('name', 100), email, phone: normalizedPhone(data.phone), date, time: displayTime(time), guests: Number(data.guests), comments: text('comments', 2000, false) };
}
