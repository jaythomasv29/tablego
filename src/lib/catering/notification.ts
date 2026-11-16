import type { cateringInput } from './input';
import type { RestaurantIdentity } from '../restaurant/config';
import { escapeHtml } from '../formatting/html.ts';
import { formatDateForDisplay } from '../../utils/dateUtils.ts';
import { dishDetails, groupDishesBySection, type SelectedDish } from '../menu/catalog.ts';

type Inquiry = ReturnType<typeof cateringInput>;
// Jobs queued before menu-catalog selections only stored { id, name }.
type StoredDish = Partial<SelectedDish> & { name: string };

function dishGroups(inquiry: Inquiry) {
  const dishes = (inquiry.selectedDishes as StoredDish[]).filter(dish => dish && typeof dish.name === 'string');
  return groupDishesBySection(dishes);
}

function dishesText(inquiry: Inquiry) {
  const groups = dishGroups(inquiry);
  if (!groups.length) return 'Menu: no dishes selected — to discuss.';
  return ['Requested menu:', ...groups.flatMap(({ section, items }) => [`${section}:`, ...items.map(dish => {
    const details = dishDetails({ choice: dish.choice || '', addOns: dish.addOns || [] });
    return `- ${dish.name}${dish.price ? ` (${dish.price})` : ''}${details ? ` — ${details}` : ''}${dish.note ? ` — Note: ${dish.note}` : ''}`;
  })])].join('\n');
}

function dishesHtml(inquiry: Inquiry) {
  const groups = dishGroups(inquiry);
  if (!groups.length) return '<p style="color:#555">No dishes selected — menu to discuss.</p>';
  const cell = 'padding:6px 8px;border-bottom:1px solid #e5e5e5;vertical-align:top;font-size:14px';
  const rows = groups.map(({ section, items }) => `<tr><th colspan="3" style="text-align:left;padding:14px 8px 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4a5a3a">${escapeHtml(section)}</th></tr>${items.map(dish => {
    const details = dishDetails({ choice: dish.choice || '', addOns: dish.addOns || [] });
    return `<tr><td style="${cell};font-weight:600">${escapeHtml(dish.name)}</td><td style="${cell}">${details ? escapeHtml(details) : '<span style="color:#888">As listed</span>'}${dish.note ? `<br><em style="color:#555">Note: ${escapeHtml(dish.note)}</em>` : ''}</td><td style="${cell};text-align:right;white-space:nowrap">${escapeHtml(dish.price || '')}</td></tr>`;
  }).join('')}`).join('');
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  return `<h2 style="font-size:16px;margin:24px 0 4px">Requested menu · ${count} ${count === 1 ? 'dish' : 'dishes'}</h2><p style="margin:0 0 4px;color:#666;font-size:12px">Menu prices are per dish as printed; the catering quote may differ.</p><table style="width:100%;border-collapse:collapse">${rows}</table>`;
}

export function renderCateringNotification(job: { recipient: string; inquiry: Inquiry }, restaurant: RestaurantIdentity) {
  const inquiry = job.inquiry, date = formatDateForDisplay(inquiry.date), staff = job.recipient !== 'guest';
  const summary = `${date} · ${inquiry.partySize} guests · ${inquiry.budget}`;
  const text = staff
    ? `New catering inquiry from ${inquiry.name} (${inquiry.email}, ${inquiry.phone}). ${summary}. ${inquiry.eventType}\n\n${dishesText(inquiry)}\n\nSpecial requests: ${inquiry.specialRequests || 'none'}`
    : `Catering inquiry received by ${restaurant.name}. ${inquiry.name}: ${date}, ${inquiry.partySize} guests. This is an inquiry; the restaurant will contact you to discuss details. ${restaurant.phoneLabel}\n\n${dishesText(inquiry)}`;
  const intro = staff
    ? `<h1>New catering inquiry</h1><p><strong>${escapeHtml(inquiry.name)}</strong> · ${escapeHtml(inquiry.email)} · ${escapeHtml(inquiry.phone)}</p>`
    : `<h1>${escapeHtml(restaurant.shortName)} catering inquiry</h1><p>Hello ${escapeHtml(inquiry.name)},</p><p>Your inquiry is saved. The restaurant will contact you to discuss details; this does not confirm a catered event.</p>`;
  return { from: process.env.EMAIL_USER, to: staff ? process.env.EMAIL_USER : inquiry.email,
    subject: staff ? `Catering inquiry — ${inquiry.name}, ${date}` : `Catering inquiry received — ${restaurant.name}`, text,
    html: `<main style="font-family:Arial,sans-serif;padding:24px;max-width:600px">${intro}<p>${escapeHtml(summary)}</p><p>${escapeHtml(inquiry.eventType)}</p>${dishesHtml(inquiry)}${inquiry.specialRequests ? `<h2 style="font-size:16px;margin:24px 0 4px">Special requests</h2><p style="white-space:pre-wrap">${escapeHtml(inquiry.specialRequests)}</p>` : ''}<p style="margin-top:24px;color:#555">${escapeHtml(restaurant.address)} · ${escapeHtml(restaurant.phoneLabel)}</p></main>` };
}
