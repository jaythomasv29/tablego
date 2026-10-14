import { verifyWebhook } from '@/lib/campaigns/provider';
import { applyCampaignWebhook } from '@/lib/campaigns/webhook';
import { privateJson, reservationError } from '@/lib/reservations/http';
export async function POST(request: Request) {
  if (!process.env.RESEND_WEBHOOK_SECRET) return privateJson({ error: 'Webhook is not configured' }, 503);
  const raw = await request.text(); if (raw.length > 65536) return privateJson({ error: 'Payload is too large' }, 413);
  if (!verifyWebhook(raw, request.headers)) return privateJson({ error: 'Invalid webhook signature' }, 401);
  try { await applyCampaignWebhook(JSON.parse(raw), request.headers.get('svix-id')!); return privateJson({ success: true }); }
  catch (error) { return reservationError(error); }
}
