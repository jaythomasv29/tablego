import type { cateringInput } from './input';
import type { RestaurantIdentity } from '../restaurant/config';
import { escapeHtml } from '../formatting/html.ts';
import { formatDateForDisplay } from '../../utils/dateUtils.ts';
export function renderCateringNotification(job: { recipient: string; inquiry: ReturnType<typeof cateringInput> }, restaurant: RestaurantIdentity) {
  const inquiry = job.inquiry, date = formatDateForDisplay(inquiry.date);
  const text = `Catering inquiry received by ${restaurant.name}. ${inquiry.name}: ${date}, ${inquiry.partySize} guests. This is an inquiry; the restaurant will contact you to discuss details. ${restaurant.phoneLabel}`;
  return { from: process.env.EMAIL_USER, to: job.recipient === 'guest' ? inquiry.email : process.env.EMAIL_USER,
    subject: `Catering inquiry received — ${restaurant.name}`, text,
    html: `<main style="font-family:Arial,sans-serif;padding:24px;max-width:600px"><h1>${escapeHtml(restaurant.shortName)} catering inquiry</h1><p>Hello ${escapeHtml(inquiry.name)},</p><p>Your inquiry is saved. The restaurant will contact you to discuss details; this does not confirm a catered event.</p><p>${escapeHtml(date)} · ${escapeHtml(inquiry.partySize)} guests · ${escapeHtml(inquiry.budget)}</p><p>${escapeHtml(inquiry.eventType)}</p><p>${escapeHtml(inquiry.selectedDishes.map(dish => dish.name).join(', '))}</p><p>${escapeHtml(inquiry.specialRequests)}</p><p>${escapeHtml(restaurant.address)} · ${escapeHtml(restaurant.phoneLabel)}</p></main>` };
}
