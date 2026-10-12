import { escapeHtml } from '../formatting/html.ts';
import { decryptToken } from './managementToken.ts';
import type { RestaurantIdentity } from '../restaurant/config.ts';
type FeedbackJob = { kind: string; reservationId: string; encryptedToken?: string; reservation: { name: string; email?: string; date?: string; time?: string; restaurantTimezone?: string }; feedback?: { sentiment: string; comment: string } };
export function renderFeedbackNotification(job: FeedbackJob, restaurant: RestaurantIdentity) {
  const guest = job.kind === 'follow-up';
  const url = new URL(guest ? '/feedback/' + encodeURIComponent(job.reservationId) : '/admin/follow-ups', process.env.NEXT_PUBLIC_BASE_URL).toString() + (guest ? '#token=' + decryptToken(job.encryptedToken!) : '');
  const title = guest ? 'How was your visit?' : 'Guest feedback received';
  const copy = guest ? 'Thank you for visiting. We would love to hear how your experience went. Your feedback is optional and goes directly to the restaurant.'
    : 'Guest-reported experience: ' + job.feedback!.sentiment + '. ' + job.feedback!.comment;
  const detail = guest ? [job.reservation.date, job.reservation.time, job.reservation.restaurantTimezone].filter(Boolean).join(' · ') : '';
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:24px 12px;background:#F9F7F2;color:#121212;font-family:Georgia,serif"><table role="presentation" width="100%" align="center" style="max-width:560px;margin:16px auto" cellspacing="0"><tr><td style="background:#121212;color:#F9F7F2;padding:32px 24px;border-radius:20px 20px 0 0;text-align:center"><p style="color:#A3B18A;font-family:Arial,sans-serif;font-size:12px">' +
    escapeHtml(restaurant.name) + '</p><h1 style="font-size:32px;font-style:italic;font-weight:normal">' + escapeHtml(title) +
    '</h1></td></tr><tr><td style="background:#ffffff;padding:28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;overflow-wrap:anywhere;word-break:break-word"><p>' +
    escapeHtml(job.reservation.name) + ',</p><p>' + escapeHtml(copy).replace(/\n/g, '<br>') + '</p><p>' + escapeHtml(detail) +
    '</p><p style="text-align:center"><a style="display:inline-block;padding:14px 24px;background:#A3B18A;color:#121212;border-radius:100px;text-decoration:none" href="' + escapeHtml(url) +
    '">' + (guest ? 'Share your experience' : 'Review feedback') + '</a></p>' +
    (guest ? '<p style="font-size:12px">You can also <a style="color:#121212" href="' + escapeHtml(url) + '">stop future visit feedback emails</a> on this page.</p>' : '<p>Guest feedback does not change attendance records. Review any reported absence with staff.</p>') +
    '</td></tr><tr><td style="padding:24px;background:#121212;color:#e4e1da;border-radius:0 0 20px 20px;text-align:center;font:12px Arial,sans-serif">' + escapeHtml(restaurant.address) + '</td></tr></table></body></html>';
  return { from: process.env.EMAIL_USER, to: guest ? job.reservation.email : process.env.EMAIL_USER, subject: title + ' — ' + restaurant.name,
    text: job.reservation.name + ', ' + copy + ' ' + detail + ' ' + url + (guest ? ' You can stop future feedback emails on this page.' : ''),
    html, headers: { 'X-TableGo-Event': job.kind, 'X-TableGo-Recipient': guest ? 'guest' : 'restaurant' } };
}
