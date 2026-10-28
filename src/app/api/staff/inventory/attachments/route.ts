import { adminSession, requireAdmin } from '@/lib/auth/admin';
import { rateLimit } from '@/lib/auth/rateLimit';
import { privateJson, ReservationError, reservationError } from '@/lib/reservations/http';
import { readInvoiceAttachment, storeInvoiceAttachment } from '@/lib/inventory/attachmentRepository';
import { MAX_INVOICE_BYTES } from '@/lib/inventory/invoiceExtraction';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const file = await readInvoiceAttachment(new URL(request.url).searchParams.get('id') || '');
    return new Response(new Uint8Array(file.bytes), { headers: { 'Content-Type': file.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(file.name)}` } });
  } catch (error) { return reservationError(error); }
}
export async function POST(request: Request) {
  const denied = await requireAdmin(request); if (denied) return denied;
  try {
    const session = await adminSession(request); if (!session) throw new ReservationError('Authentication required',401);
    const limited = await rateLimit('inventory-invoice-upload',session.id,12,60); if (limited) return limited;
    const size = Number(request.headers.get('content-length'));
    if (!Number.isFinite(size) || size > MAX_INVOICE_BYTES + 100000) throw new ReservationError('Choose an invoice up to 3 MB.');
    const reader = request.body?.getReader();
    if (!reader) throw new ReservationError('Choose an invoice file.');
    const parts: Uint8Array[] = []; let received = 0;
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      received += chunk.value.length;
      if (received > MAX_INVOICE_BYTES + 100000) { await reader.cancel(); throw new ReservationError('Choose an invoice up to 3 MB.'); }
      parts.push(chunk.value);
    }
    const body = new Uint8Array(received); let offset = 0;
    for (const part of parts) { body.set(part, offset); offset += part.length; }
    const form = await new Request(request.url, { method: 'POST', headers: { 'content-type': request.headers.get('content-type') || '' }, body }).formData(), file = form.get('file');
    if (!(file instanceof File) || file.size > MAX_INVOICE_BYTES) throw new ReservationError('Choose an invoice up to 3 MB.');
    return privateJson(await storeInvoiceAttachment(new Uint8Array(await file.arrayBuffer()),file.type,file.name,session.id));
  } catch (error) { return reservationError(error); }
}
