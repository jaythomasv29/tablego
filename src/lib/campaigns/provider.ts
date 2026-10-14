import { createHmac, timingSafeEqual } from 'node:crypto';
import { capturesNotifications } from '../notificationTransport';
import type { renderCampaign } from './render';
export function campaignProvider(): 'smtp' | 'resend' { const value = process.env.TABLEGO_CAMPAIGN_PROVIDER || 'smtp'; if (value !== 'smtp' && value !== 'resend') throw new Error('Unsupported campaign provider'); return value; }
export function assertCampaignProvider(provider = campaignProvider()) {
  if (provider !== 'resend' || capturesNotifications()) return;
  if (!process.env.RESEND_API_KEY || !/^whsec_[A-Za-z0-9+/=]+$/.test(process.env.RESEND_WEBHOOK_SECRET || '') || Buffer.from((process.env.RESEND_WEBHOOK_SECRET || '').slice(6), 'base64').length < 16 || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(process.env.CAMPAIGN_EMAIL_FROM || '')) throw new Error('Finish Resend configuration before launching: API key, verified sender, and webhook secret are required.');
}
export function campaignConfiguration() {
  const provider = campaignProvider();
  if (capturesNotifications()) return { provider, status: 'capture' };
  try { assertCampaignProvider(provider); return { provider, status: 'ready' }; } catch { return { provider, status: 'setup-required' }; }
}
export async function sendResend(message: ReturnType<typeof renderCampaign>, campaignId: string, index: number, oneClickUrl: string) {
  assertCampaignProvider('resend');
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': `tablego-campaign-${campaignId}-${index}` }, body: JSON.stringify({ from: `${message.from.name.replace(/[<>\r\n]/g, '')} <${process.env.CAMPAIGN_EMAIL_FROM}>`, to: [message.to], reply_to: message.replyTo, subject: message.subject, html: message.html, text: message.text, headers: { 'List-Unsubscribe': `<${oneClickUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }, tags: [{ name: 'tablego_campaign', value: campaignId }, { name: 'touchpoint', value: String(index) }] }) });
  if (!response.ok) throw new Error('Campaign provider did not accept the email.');
  const result = await response.json(); if (typeof result.id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(result.id)) throw new Error('Campaign provider response was incomplete.');
  return result.id as string;
}
export function verifyWebhook(raw: string, headers: Headers, secret = process.env.RESEND_WEBHOOK_SECRET || '', now = Date.now()) {
  const id = headers.get('svix-id') || '', timestamp = headers.get('svix-timestamp') || '', signatures = headers.get('svix-signature') || '';
  if (!/^whsec_[A-Za-z0-9+/=]+$/.test(secret) || Buffer.from(secret.slice(6), 'base64').length < 16 || !/^[\w-]{1,200}$/.test(id) || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || signatures.length > 2048) return false;
  const expected = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`${id}.${timestamp}.${raw}`).digest();
  return signatures.split(' ').some(signature => { if (!signature.startsWith('v1,')) return false; const actual = Buffer.from(signature.slice(3), 'base64'); return actual.length === expected.length && timingSafeEqual(expected, actual); });
}
