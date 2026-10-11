import { escapeHtml } from '../formatting/html.ts';
import { restaurantIdentity, type RestaurantIdentity } from '../restaurant/config.ts';
import type { InvitationDetails } from './sharing.ts';

export function renderReservationInvitation(job: { recipientEmail: string; reservation: InvitationDetails }, identity?: RestaurantIdentity) {
  const restaurant = identity || restaurantIdentity(null), reservation = job.reservation;
  const date = new Date(`${reservation.date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
  const menuUrl = new URL('/api/menu-download', process.env.NEXT_PUBLIC_BASE_URL).toString();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`;
  const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
  const label = `font-family:${sans};font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#586747;`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your reservation invitation</title></head>
<body style="margin:0;padding:24px 12px;background:#F9F7F2;color:#121212;font-family:Georgia,'Times New Roman',serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" align="center" style="max-width:560px;margin:16px auto;">
<tr><td style="background:#121212;padding:40px 28px;text-align:center;border-radius:20px 20px 0 0;">
<p style="margin:0 0 16px;${label}color:#A3B18A;">${escapeHtml(restaurant.shortName)} · ${escapeHtml(restaurant.location)}</p>
<h1 style="margin:0;color:#F9F7F2;font-size:38px;font-style:italic;font-weight:normal;line-height:1.15;">A table to share.</h1>
<p style="margin:18px 0 0;font-family:${sans};font-size:14px;line-height:1.7;color:#e4e1da;overflow-wrap:anywhere;word-break:break-word;">${escapeHtml(reservation.name)} shared their reservation with you.</p></td></tr>
<tr><td style="background:#ffffff;padding:28px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#EAE0D5;border-radius:16px;">
<tr><td style="padding:28px 24px;"><p style="margin:0 0 12px;${label}">Confirmed reservation</p>
<p style="margin:0 0 12px;font-size:25px;font-style:italic;line-height:1.35;">${escapeHtml(date)}</p>
<p style="margin:0 0 18px;font-family:${sans};font-size:22px;font-weight:600;">${escapeHtml(reservation.time)}</p>
<p style="margin:0;padding-top:16px;border-top:1px solid #cfc7bc;font-family:${sans};font-size:14px;line-height:1.8;overflow-wrap:anywhere;word-break:break-word;">Booked by ${escapeHtml(reservation.name)}<br>${reservation.guests} ${reservation.guests === 1 ? 'guest' : 'guests'} in the reserved party<br>Restaurant local time · ${escapeHtml(reservation.restaurantTimezone)}</p>
</td></tr></table>
<p style="margin:26px 0 8px;font-size:24px;font-style:italic;">${escapeHtml(restaurant.name)}</p>
<p style="margin:0 0 22px;font-family:${sans};font-size:14px;line-height:1.7;color:#595959;">${escapeHtml(restaurant.address)}</p>
<p style="margin:0 0 24px;"><a href="${escapeHtml(mapsUrl)}" style="display:inline-block;padding:13px 24px;border-radius:100px;background:#A3B18A;color:#121212;font-family:${sans};font-size:14px;font-weight:600;text-decoration:none;">Get directions</a> &nbsp; <a href="${escapeHtml(menuUrl)}" style="color:#121212;font-family:${sans};font-size:14px;text-decoration:underline;">Browse the menu</a></p>
<p style="margin:0;font-family:${sans};font-size:12px;line-height:1.8;color:#595959;">This shares the existing booking details and does not add guests to the party. Please check with your host if plans change; this invitation reflects the details when it was shared.</p>
</td></tr>
<tr><td style="background:#121212;padding:24px 28px;border-radius:0 0 20px 20px;text-align:center;"><p style="margin:0 0 8px;color:#A3B18A;font-size:18px;font-style:italic;">We look forward to welcoming you.</p><p style="margin:0;color:#e4e1da;font-family:${sans};font-size:12px;line-height:1.8;">${escapeHtml(restaurant.name)} · <a href="tel:${escapeHtml(restaurant.phone)}" style="color:#e4e1da;text-decoration:underline;">${escapeHtml(restaurant.phoneLabel)}</a></p></td></tr>
</table></body></html>`;
  return { from: process.env.EMAIL_USER, to: job.recipientEmail,
    subject: `Reservation invitation — ${restaurant.name}`,
    text: `${reservation.name} shared their confirmed reservation at ${restaurant.name} with you. ${date} at ${reservation.time} (${reservation.restaurantTimezone}), ${reservation.guests} guests in the reserved party. Address: ${restaurant.address}. Directions: ${mapsUrl}. Menu: ${menuUrl}. This does not add guests to the party. Check with your host if plans change.`,
    html, headers: { 'X-TableGo-Recipient': 'invitee', 'X-TableGo-Event': 'shared' },
  };
}
