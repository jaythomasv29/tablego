import { automaticConfirmation } from '../reservations/domain.ts';
import { feedbackSettings } from '../reservations/feedbackPolicy.ts';
// Public fields only. Credentials and delivery recipients remain server environment values.
export const defaultRestaurant = {
  name: 'Thaiphoon Restaurant', shortName: 'Thaiphoon', location: 'Palo Alto',
  tagline: 'Thai & Pan-Asian Flavors in the heart of Palo Alto.',
  address: '543 Emerson St, Palo Alto, CA 94301', phone: '+16503237700', phoneLabel: '(650) 323-7700',
  email: 'thaiphoonpaloalto@gmail.com', website: 'https://thaiphoonpa.com',
  mapsUrl: 'https://maps.google.com/?q=543+Emerson+St+Palo+Alto+CA+94301',
  orderUrl: 'https://order.online/business/Thaiphoon-450', cateringUrl: '/cater',
  menuPdf: '/images/Thaiphoon_Food_Pics/Thaiphoon Dinner Menu.pdf',
  promotion: '', promotionUrl: '',
};
export type RestaurantIdentity = typeof defaultRestaurant;
export function validateRestaurant(value: unknown): RestaurantIdentity {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Restaurant configuration is required');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !(key in defaultRestaurant))) throw new Error('Unknown restaurant setting');
  const result = { ...defaultRestaurant };
  for (const key of Object.keys(defaultRestaurant) as (keyof RestaurantIdentity)[]) {
    if (!(key in input)) continue;
    if (typeof input[key] !== 'string' || (input[key] as string).length > 500) throw new Error(`Invalid ${key}`);
    result[key] = (input[key] as string).trim();
  }
  if (['name', 'shortName', 'location', 'address', 'phoneLabel', 'tagline'].some(key => !result[key as keyof RestaurantIdentity])) throw new Error('Identity and contact fields are required');
  if (!/^\+[1-9]\d{7,14}$/.test(result.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Valid restaurant phone and email are required');
  for (const key of ['website', 'mapsUrl', 'orderUrl', 'cateringUrl', 'menuPdf', 'promotionUrl'] as const) {
    const url = result[key];
    if (!url && key === 'promotionUrl') continue;
    if (/^\/(?!\/)/.test(url) && !/[\\\r\n]/.test(url)) continue;
    try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(); }
    catch { throw new Error(`${key} must be a local path or HTTPS URL`); }
  }
  return result;
}
export function restaurantIdentity(value: unknown): RestaurantIdentity {
  try { return validateRestaurant(value || {}); } catch { return { ...defaultRestaurant }; }
}
export function validateGeneral(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Settings are required');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !['timezone', 'reservationCutoffMinutes', 'minimumLeadTimeMinutes', 'restaurant', 'version', 'autoConfirmReservations', 'followUpDelayMinutes', 'reviewUrl'].includes(key))) throw new Error('Unknown general setting');
  if (typeof input.timezone !== 'string' || !input.timezone.trim()) throw new Error('Business timezone is required');
  try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }).format(); } catch { throw new Error('Invalid business timezone'); }
  for (const key of ['reservationCutoffMinutes', 'minimumLeadTimeMinutes']) if (!Number.isInteger(input[key]) || Number(input[key]) < 0 || Number(input[key]) > 720) throw new Error(`${key} must be a whole number from 0 to 720`);
  if (!Number.isInteger(input.version) || Number(input.version) < 0) throw new Error('A settings version is required');
  return { ...feedbackSettings(input), autoConfirmReservations: automaticConfirmation(input.autoConfirmReservations), timezone: input.timezone, reservationCutoffMinutes: Number(input.reservationCutoffMinutes), minimumLeadTimeMinutes: Number(input.minimumLeadTimeMinutes), restaurant: validateRestaurant(input.restaurant) };
}
