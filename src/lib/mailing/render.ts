import { escapeHtml } from '../formatting/html.ts';
import { decryptToken } from '../reservations/managementToken.ts';
import type { RestaurantIdentity } from '../restaurant/config';
export function preferenceUrl(id: string, token: string, action: 'confirm' | 'unsubscribe') {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (!base) throw new Error('Site URL is not configured');
  return `${base.replace(/\/$/, '')}/mailing/preferences#${new URLSearchParams({ id, token, action })}`;
}
export function renderMailingConfirmation(job: { entityId: string; email: string; encryptedConfirmation: string; encryptedUnsubscribe: string }, restaurant: RestaurantIdentity) {
  const confirm = preferenceUrl(job.entityId, decryptToken(job.encryptedConfirmation), 'confirm');
  const unsubscribe = preferenceUrl(job.entityId, decryptToken(job.encryptedUnsubscribe), 'unsubscribe');
  const text = `Confirm your email for ${restaurant.name}\n\nYou requested monthly promotions and special offers. Confirm your subscription within 48 hours: ${confirm}\n\nIf you did not request this, ignore this email. You will not be subscribed without confirmation. Stop promotional emails: ${unsubscribe}\n\n${restaurant.name}\n${restaurant.address}\n${restaurant.email}`;
  return { from: { name: restaurant.name, address: process.env.EMAIL_USER || restaurant.email }, replyTo: restaurant.email, to: job.email,
    subject: `Confirm your email — ${restaurant.name}`, text,
    html: `<div style="background:#F9F7F2;padding:24px 12px"><main style="background:white;border:1px solid #e4e4e7;border-radius:20px;max-width:540px;margin:auto;padding:32px 24px;font-family:Arial,sans-serif;color:#18181b;line-height:1.6"><p style="text-transform:uppercase;letter-spacing:3px;font-size:12px;color:#526341">${escapeHtml(restaurant.shortName)}</p><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">One last step. Then, something delicious.</h1><p>You asked to hear about our monthly promotions and special offers. Confirm your email to join the list.</p><p style="margin:28px 0"><a href="${escapeHtml(confirm)}" style="display:inline-block;background:#A3B18A;color:#121212;padding:14px 22px;border-radius:28px;text-decoration:none;font-weight:bold">Confirm my subscription</a></p><p style="font-size:13px">This link expires in 48 hours. If you didn’t request this, simply ignore this email. You won’t be subscribed without confirming.</p><p style="font-size:12px;border-top:1px solid #e4e4e7;padding-top:20px"><a href="${escapeHtml(unsubscribe)}" style="color:#526341">Unsubscribe from promotional emails</a><br>${escapeHtml(restaurant.name)}<br>${escapeHtml(restaurant.address)}<br><a href="mailto:${escapeHtml(restaurant.email)}" style="color:#526341">${escapeHtml(restaurant.email)}</a></p></main></div>` };
}
