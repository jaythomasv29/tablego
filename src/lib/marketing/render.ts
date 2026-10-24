import type { MarketingCandidate } from './policy';
import type { RestaurantIdentity } from '../restaurant/config';
import { escapeHtml } from '../formatting/html.ts';

export function marketingCopy(candidate: Pick<MarketingCandidate, 'kind' | 'name'>, restaurant: RestaurantIdentity, baseUrl: string) {
  const catering = candidate.kind === 'catering';
  const subject = catering ? `Planning another gathering? ${restaurant.shortName} can help` : `We’d love to welcome you back to ${restaurant.shortName}`;
  const url = new URL(catering ? '/cater' : '/reservation', baseUrl).toString();
  const body = `Hello ${candidate.name},\n\n${catering
    ? `Planning your next team lunch, celebration, or gathering? We’d love to help with catering from ${restaurant.name}.`
    : `It’s been a little while! We’d love to welcome you back for another meal at ${restaurant.name}.`}\n\n${catering ? 'Explore catering and send us an inquiry' : 'Make your next reservation'}: ${url}\n\nQuestions? Call ${restaurant.phoneLabel}.\n\n${restaurant.name}\n${restaurant.address}`;
  return { subject, body };
}
export function renderMarketingNotification(job: { candidate: MarketingCandidate; subject: string; body: string; unsubscribeUrl: string }) {
  const text = `${job.body}\n\nUnsubscribe from restaurant marketing emails: ${job.unsubscribeUrl}`;
  return { from: process.env.EMAIL_USER, to: job.candidate.email, subject: job.subject, text,
    headers: { 'List-Unsubscribe': `<${job.unsubscribeUrl.replace('/marketing/unsubscribe?', '/api/marketing/unsubscribe?')}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    html: `<main style="font-family:Arial,sans-serif;max-width:600px;padding:24px;white-space:pre-wrap">${escapeHtml(job.body)}<p><a href="${escapeHtml(job.unsubscribeUrl)}">Unsubscribe from restaurant marketing emails</a></p></main>` };
}

export function marketingTestMessage(copy: { subject: string; body: string }) {
  const note = 'This is a test email. No customer follow-up was approved and no mailing preferences were changed.';
  return {
    subject: `[TEST] ${copy.subject}`,
    text: `${copy.body}\n\n${note}`,
    html: `<main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;color:#1c1c1c;background:#ffffff"><p style="font-size:12px;letter-spacing:2px;color:#66734f;margin:0 0 24px">TEST PREVIEW</p><div style="white-space:pre-wrap;line-height:1.65">${escapeHtml(copy.body)}</div><p style="border-top:1px solid #e5e5e5;padding-top:20px;margin-top:24px;font-size:12px;line-height:1.6;color:#666">${note}</p></main>`,
  };
}
export function renderMarketingTestNotification(job: { email: string; subject: string; body: string }) {
  return { from: process.env.EMAIL_USER, to: job.email, ...marketingTestMessage(job) };
}
