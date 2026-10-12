import { validDate } from '../reservations/availability.ts';
import { normalizedPhone } from '../reservations/input.ts';
export function cateringInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Catering details are required');
  const input = value as Record<string, unknown>;
  const field = (key: string, limit: number, required = true) => {
    const value = input[key]; if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) throw new Error(`Enter valid ${key}`); return value.trim();
  };
  const name = field('name', 120), email = field('email', 254), phone = normalizedPhone(field('phone', 40)), date = field('date', 10);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[\d+()\s.-]{7,40}$/.test(phone) || !validDate(date)) throw new Error('Valid contact details and a calendar date are required');
  if (!Array.isArray(input.selectedDishes) || input.selectedDishes.length > 30) throw new Error('Select at most 30 dishes');
  const selectedDishes = input.selectedDishes.map((dish: Record<string, unknown>) => {
    if (!dish || typeof dish.id !== 'string' || dish.id.length > 128 || typeof dish.name !== 'string' || dish.name.length > 120) throw new Error('Invalid dish selection');
    return { id: dish.id, name: dish.name.trim() };
  });
  return { name, email, phone, date, address: typeof input.address === 'string' ? field('address', 500, false) : '',
    time: typeof input.time === 'string' ? field('time', 30, false) : '', partySize: field('partySize', 30), budget: field('budget', 100),
    eventType: typeof input.eventType === 'string' ? field('eventType', 100, false) : '', specialRequests: typeof input.specialRequests === 'string' ? field('specialRequests', 2000, false) : '', selectedDishes };
}
