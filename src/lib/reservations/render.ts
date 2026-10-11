import { escapeHtml } from '../formatting/html.ts';
import { restaurantIdentity, type RestaurantIdentity } from '../restaurant/config.ts';
import { decryptToken, managementUrl } from './managementToken.ts';
import { statusLabels, type BookingState } from './domain.ts';
import type { BookingInput } from './input.ts';
import type { ReservationEvent } from './notifications';
export function renderNotification(job: { restaurant?: RestaurantIdentity; event: ReservationEvent; recipient: string; reservationId: string; encryptedToken: string; reservation: BookingInput & { status: BookingState; restaurantTimezone?: string } }) {
  const reservation = job.reservation;
  const restaurant = job.restaurant || restaurantIdentity(null);
  const titles: Record<ReservationEvent, string> = { created: 'Reservation request received', confirmed: 'Reservation accepted', rescheduled: 'Reservation change requested',
    cancelled: 'Reservation cancelled', reminder: 'Upcoming reservation reminder', recovered: 'Your secure reservation link', seated: 'Guest seated', completed: 'Visit completed', 'no-show': 'Reservation marked no-show' };
  const url = managementUrl(job.reservationId, decryptToken(job.encryptedToken));
  const date = new Date(`${reservation.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const text = `${titles[job.event]}. ${reservation.name}: ${date} at ${reservation.time} (${reservation.restaurantTimezone || "America/Los_Angeles"}), ${reservation.guests} guests. Status: ${statusLabels[reservation.status]}. ${reservation.status === 'pending' ? 'The restaurant still needs to accept this request. ' : ''}Manage reservation: ${url}`;
  return { from: process.env.EMAIL_USER, to: job.recipient === 'guest' ? reservation.email : process.env.EMAIL_USER,
    subject: `${titles[job.event]} — ${restaurant.name}`, text,
    html: `<main style="max-width:600px;margin:32px auto;padding:32px;font-family:Arial,sans-serif;color:#121212;background:#f9f7f2;border-radius:16px"><p>${escapeHtml(restaurant.shortName)} · ${escapeHtml(restaurant.location)}</p><h1>${escapeHtml(titles[job.event])}</h1><p>Hello ${escapeHtml(reservation.name)},</p><p>${escapeHtml(date)} at ${escapeHtml(reservation.time)} (${escapeHtml(reservation.restaurantTimezone || "America/Los_Angeles")}) · ${reservation.guests} guests</p><p><strong>${escapeHtml(statusLabels[reservation.status])}</strong></p>${reservation.status === 'pending' ? '<p>The restaurant still needs to accept this request. Guest acknowledgement does not confirm a table.</p>' : ''}<p>${escapeHtml(reservation.comments)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 20px;background:#121212;color:#fff;border-radius:8px">Manage reservation</a></p><p>${escapeHtml(restaurant.address)} · ${escapeHtml(restaurant.phoneLabel)}</p>${restaurant.promotion ? `<p>${escapeHtml(restaurant.promotion)}${restaurant.promotionUrl ? ` <a href="${escapeHtml(restaurant.promotionUrl)}">Details</a>` : ''}</p>` : ''}</main>` };
}
