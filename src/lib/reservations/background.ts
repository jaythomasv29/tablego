import { after } from 'next/server';
import { deliverEvent } from './notifications';
export function scheduleDelivery(eventId: string) {
  // The durable worker is authoritative; after() is a latency optimization.
  try { after(async () => { await deliverEvent(eventId); }); }
  catch { /* A non-request caller relies on the persistent worker. */ }
}
