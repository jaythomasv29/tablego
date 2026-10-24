import type { MarketingCandidate } from './policy';
import type { RestaurantIdentity } from '../restaurant/config';
import { escapeHtml } from '../formatting/html.ts';

export interface MarketingDesign {
  version: 1;
  brand: string; location: string; restaurantName: string; address: string; phone: string; phoneLabel: string;
  eyebrow: string; headline: string; greeting: string; introduction: string;
  featureTitle: string; featureCopy: string; actionLabel: string; actionUrl: string; menuUrl: string;
}
export interface MarketingCopy { subject: string; body: string; design?: MarketingDesign }
export function marketingCopy(candidate: Pick<MarketingCandidate, 'kind' | 'name'>, restaurant: RestaurantIdentity, baseUrl: string): MarketingCopy {
  const catering = candidate.kind === 'catering';
  const subject = catering ? `Planning another gathering? ${restaurant.shortName} can help` : `We’d love to welcome you back to ${restaurant.shortName}`;
  const design: MarketingDesign = {
    version: 1, brand: restaurant.shortName, location: restaurant.location, restaurantName: restaurant.name,
    address: restaurant.address, phone: restaurant.phone, phoneLabel: restaurant.phoneLabel,
    eyebrow: catering ? 'For your next gathering' : 'An invitation to return',
    headline: catering ? 'Good food.\nGreat company.' : 'There’s a place\nfor you.',
    greeting: `Hello ${candidate.name},`,
    introduction: catering ? `Planning your next team lunch, celebration, or gathering? We’d love to help with catering from ${restaurant.name}.`
      : `It’s been a little while! We’d love to welcome you back for another meal at ${restaurant.name}.`,
    featureTitle: catering ? 'A gathering worth sharing.' : 'Make an evening of it.',
    featureCopy: catering ? 'Bring everyone together over Thai & Pan-Asian favorites. Tell us what you’re planning, and we’ll take it from there.'
      : 'Your favorite flavors, good conversation, and a table waiting for you. Take a look at the menu and plan your next visit.',
    actionLabel: catering ? 'Plan your next gathering' : 'Reserve a table',
    actionUrl: new URL(catering ? '/cater' : '/reservation', baseUrl).toString(),
    menuUrl: new URL('/menu', baseUrl).toString(),
  };
  const body = [design.greeting, design.introduction, `${design.featureTitle}\n${design.featureCopy}`,
    `${design.actionLabel}: ${design.actionUrl}`, `Explore our menu: ${design.menuUrl}`,
    `Questions? Call ${restaurant.phoneLabel}.`, `${restaurant.name}\n${restaurant.address}`].join('\n\n');
  return { subject, body, design };
}

const sans = "-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
function webLink(value: string) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? escapeHtml(url.toString()) : '#'; }
  catch { return '#'; }
}
function brandedMarketingHtml(copy: MarketingCopy, options: { test?: boolean; unsubscribeUrl?: string }) {
  const d = copy.design;
  const testNote = 'This is a test email. No customer follow-up was approved and no mailing preferences were changed.';
  const footer = options.test ? `<p style="margin:0;font:12px/1.8 ${sans};color:#626262;">${testNote}</p>`
    : `<p style="margin:0;font:12px/1.8 ${sans};color:#626262;">Prefer fewer emails? <a href="${webLink(options.unsubscribeUrl || '')}" style="color:#4b593c;text-decoration:underline;">Unsubscribe from restaurant marketing emails</a>.</p>`;
  const content = d ? `
<tr><td style="padding:38px 28px 34px;background-color:#ffffff;">
<p style="margin:0 0 18px;font:italic 25px/1.4 Georgia,'Times New Roman',serif;color:#121212;overflow-wrap:anywhere;">${escapeHtml(d.greeting)}</p>
<p style="margin:0;font:15px/1.85 ${sans};color:#454545;">${escapeHtml(d.introduction)}</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="margin-top:28px;"><tr><td style="padding:26px 24px;background-color:#EAE0D5;border-radius:12px;">
<p style="margin:0 0 12px;font:italic 26px/1.25 Georgia,'Times New Roman',serif;color:#121212;">${escapeHtml(d.featureTitle)}</p>
<p style="margin:0;font:14px/1.8 ${sans};color:#49443e;">${escapeHtml(d.featureCopy)}</p></td></tr></table>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:30px auto 0;"><tr><td align="center" bgcolor="#A3B18A" style="border-radius:100px;"><a href="${webLink(d.actionUrl)}" style="display:inline-block;border:1px solid #A3B18A;border-radius:100px;padding:16px 30px;font:600 14px/1.4 ${sans};color:#121212;text-decoration:none;">${escapeHtml(d.actionLabel)} &rarr;</a></td></tr></table>
<p style="margin:20px 0 0;text-align:center;font:13px/1.8 ${sans};"><a href="${webLink(d.menuUrl)}" style="color:#4b593c;text-decoration:underline;">Explore our menu</a></p>
</td></tr>
<tr><td style="padding:0 28px 32px;background-color:#ffffff;"><table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%"><tr><td style="border-top:1px solid #e7e4dd;padding-top:24px;text-align:center;">
<p style="margin:0 0 4px;font:italic 21px/1.4 Georgia,'Times New Roman',serif;color:#121212;">We’d love to hear from you.</p>
<p style="margin:0;font:13px/1.8 ${sans};color:#595959;">Questions? Call <a href="tel:${escapeHtml(String(d.phone || '').replace(/[^+\d]/g, ''))}" style="color:#121212;text-decoration:underline;">${escapeHtml(d.phoneLabel)}</a></p>
</td></tr></table></td></tr>`
    : `<tr><td style="padding:32px 28px;background-color:#ffffff;white-space:pre-wrap;font:15px/1.8 ${sans};color:#454545;">${escapeHtml(copy.body)}</td></tr>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(copy.subject)}</title></head>
<body style="margin:0;padding:24px 12px;background-color:#F9F7F2;color:#121212;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(d?.introduction || copy.subject)}</div>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" width="100%" style="max-width:600px;margin:0 auto;">
${options.test ? `<tr><td align="center" style="padding:0 12px 14px;font:600 10px/1.6 ${sans};letter-spacing:2px;color:#586747;">TEST PREVIEW &nbsp;·&nbsp; NOT A CUSTOMER CAMPAIGN</td></tr>` : ''}
<tr><td align="center" bgcolor="#121212" style="padding:38px 24px 40px;border-radius:16px 16px 0 0;">
<p style="margin:0 0 30px;font:600 11px/1.6 ${sans};letter-spacing:3px;color:#A3B18A;text-transform:uppercase;">${escapeHtml(d?.brand || 'A note from the restaurant')}${d?.location ? ` &nbsp;·&nbsp; ${escapeHtml(d.location)}` : ''}</p>
<p style="margin:0 0 14px;font:500 10px/1.6 ${sans};letter-spacing:2px;text-transform:uppercase;color:#d0d4c8;">${escapeHtml(d?.eyebrow || 'A little inspiration')}</p>
<h1 style="margin:0;font:italic 42px/1.12 Georgia,'Times New Roman',serif;letter-spacing:-1px;color:#F9F7F2;">${escapeHtml(d?.headline || copy.subject).replace(/\n/g, '<br>')}</h1>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:26px auto 0;"><tr><td bgcolor="#A3B18A" width="44" height="2" style="font-size:1px;line-height:2px;">&nbsp;</td></tr></table>
</td></tr>${content}
<tr><td align="center" bgcolor="#121212" style="padding:28px 24px;border-radius:0 0 16px 16px;">
${d ? `<p style="margin:0 0 8px;font:italic 20px/1.5 Georgia,'Times New Roman',serif;color:#A3B18A;">${escapeHtml(d.restaurantName)}</p><p style="margin:0;font:12px/1.8 ${sans};color:#c2c2c2;">${escapeHtml(d.address)}</p>` : `<p style="margin:0;font:italic 20px/1.5 Georgia,'Times New Roman',serif;color:#A3B18A;">Until next time.</p>`}
</td></tr><tr><td align="center" style="padding:20px 20px 6px;">${footer}</td></tr>
</table></body></html>`;
}
export function renderMarketingNotification(job: MarketingCopy & { candidate: MarketingCandidate; unsubscribeUrl: string }) {
  return { from: process.env.EMAIL_USER, to: job.candidate.email, subject: job.subject,
    text: `${job.body}\n\nUnsubscribe from restaurant marketing emails: ${job.unsubscribeUrl}`,
    headers: { 'List-Unsubscribe': `<${job.unsubscribeUrl.replace('/marketing/unsubscribe?', '/api/marketing/unsubscribe?')}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    html: brandedMarketingHtml(job, { unsubscribeUrl: job.unsubscribeUrl }) };
}
export function marketingTestMessage(copy: MarketingCopy) {
  return { subject: `[TEST] ${copy.subject}`,
    text: `${copy.body}\n\nThis is a test email. No customer follow-up was approved and no mailing preferences were changed.`,
    html: brandedMarketingHtml(copy, { test: true }) };
}
export function renderMarketingTestNotification(job: MarketingCopy & { email: string }) {
  return { from: process.env.EMAIL_USER, to: job.email, ...marketingTestMessage(job) };
}
