import { escapeHtml } from '../formatting/html.ts';
import { restaurantIdentity, type RestaurantIdentity } from '../restaurant/config.ts';
import { decryptToken, managementUrl } from './managementToken.ts';
import { statusLabels, type BookingState } from './domain.ts';
import type { BookingInput } from './input.ts';
import type { ReservationEvent } from './notifications';

export function renderNotification(job: { restaurant?: RestaurantIdentity; event: ReservationEvent; recipient: string; reservationId: string; encryptedToken: string; reservation: BookingInput & { status: BookingState; restaurantTimezone?: string; providerTestRunId?: string; cancellationReason?: string } }) {
  const reservation = job.reservation;
  const restaurant = job.restaurant || restaurantIdentity(null);
  const titles: Record<ReservationEvent, string> = {
    created: 'Reservation request received', confirmed: 'Reservation confirmed', rescheduled: 'Reservation change requested', updated: 'Reservation details updated',
    cancelled: 'Reservation cancelled', reminder: 'Upcoming reservation reminder', recovered: 'Your secure reservation link',
    seated: 'Guest seated', completed: 'Visit completed', 'no-show': 'Reservation marked no-show',
  };
  if (job.event === 'created' && reservation.status === 'confirmed') titles.created = 'Reservation confirmed';
  if (job.event === 'rescheduled' && reservation.status === 'confirmed') titles.rescheduled = 'Reservation change confirmed';
  const url = managementUrl(job.reservationId, decryptToken(job.encryptedToken));
  const timezone = reservation.restaurantTimezone || 'America/Los_Angeles';
  const date = new Date(`${reservation.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const responseCopy = reservation.status === 'confirmed'
    ? 'Your table is confirmed. Use the secure link to let the restaurant know you are coming, reschedule, or cancel.'
    : reservation.status === 'pending' ? 'The restaurant still needs to accept this request. Guest acknowledgement does not confirm a table.'
    : `Your reservation is ${statusLabels[reservation.status].toLowerCase()}. Use your secure link to review the latest details.`;
  const heading = job.event === 'created' && reservation.status === 'confirmed' ? 'Your table is confirmed.' : `${titles[job.event]}.`;
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  const label = `font-family:${sans};font-size:11px;font-weight:600;letter-spacing:0.10em;text-transform:uppercase;color:#595959;`;
  const rows = [['Guest', reservation.name], ['Date', date], ['Time', `${reservation.time} · ${timezone}`],
    ['Party size', `${reservation.guests} ${reservation.guests === 1 ? 'guest' : 'guests'}`], ['Status', statusLabels[reservation.status]],
    ...(reservation.comments ? [['Special requests', reservation.comments]] : []),
    ...(reservation.status === 'cancelled' && reservation.cancellationReason ? [['Cancellation reason', reservation.cancellationReason]] : [])];
  const menuUrl = new URL('/api/menu-download', process.env.NEXT_PUBLIC_BASE_URL).toString();
  const cateringUrl = restaurant.cateringUrl ? new URL(restaurant.cateringUrl, process.env.NEXT_PUBLIC_BASE_URL).toString() : '';
  const text = `${titles[job.event]}. ${reservation.name}: ${date} at ${reservation.time} (${timezone}), ${reservation.guests} guests. Status: ${statusLabels[reservation.status]}.${reservation.comments ? ` Special requests: ${reservation.comments}.` : ''}${reservation.status === 'cancelled' && reservation.cancellationReason ? ` Cancellation reason: ${reservation.cancellationReason}.` : ''} ${responseCopy} Manage reservation: ${url}`;
  // Presentation tables and inline styles preserve the restaurant theme in email clients.
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(titles[job.event])}</title></head>
<body style="margin:0;padding:24px 12px;background-color:#F9F7F2;color:#121212;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:16px auto;">
<tr><td style="background-color:#121212;padding:44px 28px 36px;border-radius:16px 16px 0 0;text-align:center;">
<p style="margin:0 0 12px;color:#A3B18A;font-family:${sans};font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">${escapeHtml(restaurant.shortName)} · ${escapeHtml(restaurant.location)}</p>
<h1 style="margin:0;color:#F9F7F2;font-size:34px;font-weight:normal;font-style:italic;line-height:1.2;">${escapeHtml(heading)}</h1>
<p style="margin:24px auto 0;width:48px;height:2px;background-color:#A3B18A;font-size:1px;">&nbsp;</p></td></tr>
${restaurant.promotion ? `<tr><td style="background-color:#A3B18A;padding:14px 24px;text-align:center;font-family:${sans};font-size:13px;line-height:1.6;">${escapeHtml(restaurant.promotion)}${restaurant.promotionUrl ? ` <a href="${escapeHtml(new URL(restaurant.promotionUrl, process.env.NEXT_PUBLIC_BASE_URL).toString())}" style="color:#121212;text-decoration:underline;">Details</a>` : ''}</td></tr>` : ''}
<tr><td style="background-color:#ffffff;padding:32px 28px;">
<p style="margin:0 0 8px;${label}color:#586747;">${job.recipient === 'guest' ? 'Welcome' : 'Reservation update'}</p>
<p style="margin:0 0 20px;font-size:24px;font-style:italic;overflow-wrap:anywhere;">${job.recipient === 'guest' ? 'Dear ' : ''}${escapeHtml(reservation.name)},</p>
<p style="margin:0 0 24px;font-family:${sans};font-size:14px;color:#4b4b4b;line-height:1.7;">${escapeHtml(responseCopy)}</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#EAE0D5;border-radius:12px;">
<tr><td style="padding:22px 24px 8px;${label}color:#586747;">Reservation details</td></tr>
${rows.map(([name, value]) => `<tr><td style="padding:12px 24px;border-bottom:1px solid #cfc7bc;"><span style="${label}">${escapeHtml(name)}</span><br><span style="display:block;margin-top:5px;font-family:${sans};font-size:15px;line-height:1.6;overflow-wrap:anywhere;">${escapeHtml(value)}</span></td></tr>`).join('')}
<tr><td style="padding:8px;"></td></tr></table>
<p style="margin:24px 0 16px;text-align:center;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;background-color:#A3B18A;color:#121212;border-radius:100px;font-family:${sans};font-size:14px;font-weight:600;text-decoration:none;">Manage your reservation</a></p>
<p style="margin:0;font-family:${sans};font-size:13px;color:#595959;line-height:1.7;text-align:center;">Questions? Call <a href="tel:${escapeHtml(restaurant.phone)}" style="color:#121212;text-decoration:underline;">${escapeHtml(restaurant.phoneLabel)}</a>.</p>
</td></tr>
<tr><td style="background-color:#ffffff;padding:0 28px 28px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%"><tr><td style="background-color:#121212;border-radius:12px;padding:28px 24px;text-align:center;">
<p style="margin:0 0 8px;${label}color:#A3B18A;">Before you arrive</p><p style="margin:0 0 20px;color:#F9F7F2;font-size:24px;font-style:italic;">Browse our menu.</p>
<a href="${escapeHtml(menuUrl)}" style="display:inline-block;background-color:#A3B18A;color:#121212;padding:12px 28px;border-radius:100px;font-family:${sans};font-size:13px;font-weight:600;text-decoration:none;">Download menu</a>
</td></tr></table></td></tr>
${cateringUrl ? `<tr><td style="background-color:#EAE0D5;padding:28px 24px;text-align:center;"><p style="margin:0 0 16px;font-size:24px;font-style:italic;">Something for your next gathering.</p><a href="${escapeHtml(cateringUrl)}" style="display:inline-block;background-color:#121212;color:#F9F7F2;padding:12px 28px;border-radius:100px;font-family:${sans};font-size:13px;font-weight:600;text-decoration:none;">Explore catering</a></td></tr>` : ''}
<tr><td style="background-color:#121212;padding:28px 24px;border-radius:0 0 16px 16px;text-align:center;"><p style="margin:0 0 8px;color:#A3B18A;font-size:16px;font-style:italic;">${escapeHtml(restaurant.name)}</p><p style="margin:0;color:#c2c2c2;font-family:${sans};font-size:12px;line-height:1.8;">${escapeHtml(restaurant.address)} · ${escapeHtml(restaurant.phoneLabel)}</p></td></tr>
</table></body></html>`;
  return { from: process.env.EMAIL_USER, to: job.recipient === 'guest' ? reservation.email : process.env.EMAIL_USER,
    subject: `${titles[job.event]} — ${restaurant.name}`, text, html,
    headers: { 'X-TableGo-Provider-Test-Run': reservation.providerTestRunId || '', 'X-TableGo-Recipient': job.recipient, 'X-TableGo-Status': reservation.status, 'X-TableGo-Event': job.event },
  };
}
