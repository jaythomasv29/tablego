import { restaurantClock } from '../reservations/availability.ts';
export interface Promotion {
  id: string; label: string; title: string; description: string; qualification: string; terms: string;
  image?: string; imageAlt?: string; flyerUrl?: string; startsOn?: string; endsOn?: string;
}
// Owner-supplied flyer; Happy Hour timing verified against the live restaurant banner.
export const promotions: Promotion[] = [
  { id: 'local-lunch-perk-through-2026-12-12', label: 'Local lunch perk', title: '10% off lunch',
    description: 'Work nearby? Enjoy 10% off dine-in lunch at Thaiphoon. Show your local employee badge or business card to redeem.',
    qualification: 'Local business employees · Dine-in during lunch hours · Food & non-alcoholic beverages only',
    terms: 'Valid through December 12, 2026. A valid local employee badge or business card is required. Excludes takeout, online orders, third-party delivery services (including DoorDash and UberEats), and happy hour specials. Cannot be combined with other offers.',
    endsOn: '2026-12-12', flyerUrl: '/promotions/thaiphoon-local-lunch-perk-2026.pdf', image: '/promotions/thaiphoon-local-lunch-perk-2026.webp', imageAlt: 'Thaiphoon local lunch perk flyer: 10% off dine-in lunch for local business employees through December 12, 2026.' },
  { id: 'happy-hour-daily-4-6', label: 'Happy Hour', title: 'Every day, 4–6 PM',
    description: 'Make time for Happy Hour at Thaiphoon, every day from 4 PM to 6 PM.',
    qualification: '4–6 PM in the restaurant’s local time',
    terms: 'Ask our team about the current happy hour menu and specials. The Local Lunch Perk cannot be applied to happy hour specials.' },
];
export function activePromotions(timezone: string, now = new Date()): Promotion[] {
  const date = restaurantClock(timezone, now).date;
  return promotions.filter(offer => (!offer.startsOn || offer.startsOn <= date) && (!offer.endsOn || offer.endsOn >= date));
}
