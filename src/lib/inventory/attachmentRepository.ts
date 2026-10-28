import { randomUUID } from 'node:crypto';
import { getServerDatabase } from '../serverFirebase';
import { ReservationError } from '../reservations/http';
import { validateInvoiceFile, invoiceFilename } from './invoiceExtraction';
const path = 'inventoryOperations/attachments/records';
export async function storeInvoiceAttachment(bytes: Uint8Array, type: string, name: string, actor: string) {
  try { validateInvoiceFile(bytes, type); } catch (error) { throw new ReservationError((error as Error).message); }
  const db = getServerDatabase(), id = randomUUID(), ref = db.doc(`${path}/${id}`), batch = db.batch();
  const chunkSize = 180 * 1024, chunks = Math.ceil(bytes.length / chunkSize);
  const metadata = { name: invoiceFilename(name), type, size: bytes.length, chunks, actor, at: new Date().toISOString() };
  batch.create(ref, metadata);
  for (let i = 0; i < chunks; i++) batch.create(ref.collection('chunks').doc(String(i).padStart(3,'0')), { bytes: Buffer.from(bytes.slice(i * chunkSize, (i + 1) * chunkSize)) });
  await batch.commit();
  return { attachmentId: id, name: metadata.name, type };
}
export async function readInvoiceAttachment(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new ReservationError('Choose a valid invoice attachment');
  const ref = getServerDatabase().doc(`${path}/${id}`), metadata = await ref.get();
  if (!metadata.exists) throw new ReservationError('Invoice attachment not found', 404);
  const data = metadata.data()!, chunks = await ref.collection('chunks').orderBy('__name__').get();
  if (chunks.size !== data.chunks) throw new ReservationError('Invoice attachment is incomplete', 503);
  return { bytes: Buffer.concat(chunks.docs.map(doc => Buffer.from(doc.data().bytes))), type: String(data.type), name: invoiceFilename(String(data.name)) };
}
