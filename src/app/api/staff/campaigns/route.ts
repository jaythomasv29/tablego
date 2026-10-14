import { capturesNotifications } from '@/lib/notificationTransport';
import { campaignConfiguration, campaignProvider } from '@/lib/campaigns/provider';
import { after } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { changeCampaign, deliverCampaign, listCampaigns, saveCampaign } from '@/lib/campaigns/repository';
import { campaignMetrics, recommendedCampaign, TEST_RECIPIENT } from '@/lib/campaigns/policy';
import { privateJson, reservationError, ReservationError } from '@/lib/reservations/http';
export const maxDuration = 60;
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try { const campaigns = await listCampaigns(); return privateJson({ campaigns, metrics: campaignMetrics(campaigns), recommended: recommendedCampaign(), recipient: TEST_RECIPIENT, capture: capturesNotifications(), configuration: campaignConfiguration().status, provider: campaignProvider(), deliveryWindow: '18:00–19:00 UTC daily (10 AM–noon in Palo Alto, depending on daylight saving time). First email sends on launch.' }); }
  catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const raw = await request.text(); if (raw.length > 30000) throw new ReservationError('Campaign is too large.', 413);
    const body = JSON.parse(raw);
    if (!body || typeof body !== 'object') throw new ReservationError('Choose a campaign action.');
    if (body.action === 'save') return privateJson({ id: await saveCampaign(body.campaign, body.id, body.version) });
    if (!['launch', 'pause', 'resume', 'cancel', 'skip', 'review'].includes(body.action)) throw new ReservationError('Choose a valid campaign action.');
    await changeCampaign(body.id, body.version, body.action, body.index);
    if (body.action === 'launch') { try { after(async () => { await deliverCampaign(body.id, body.action === 'launch'); }); } catch { /* Daily worker recovers a queued send. */ } }
    return privateJson({ success: true });
  } catch (error) { return reservationError(error); }
}
