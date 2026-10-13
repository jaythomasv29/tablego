import { cateringLead, cateringRecord, closedCatering, type CateringStatus } from './admin.ts';
export const bulkCloseLimit = 100;
export const bulkCloseLifetime = 15 * 60 * 1000;
export function cateringStamp(value: { seconds: number; nanoseconds: number } | undefined) {
  return value ? `${value.seconds}:${value.nanoseconds}` : null;
}
export type BulkCloseItem = { id: string; name: string; date: string; status: CateringStatus; version: number; recordStamp: string | null; staffStamp: string | null };
export function bulkClosePlan(records: { id: string; data: Record<string, unknown>; stamp: string | null }[], staff: Map<string, { data: Record<string, unknown>; stamp: string | null }>, timezone: string) {
  const active = records.map(record => {
    const privateRecord = staff.get(record.id), lead = cateringLead(record.id, cateringRecord(record.data, privateRecord?.data), timezone);
    return { ...lead, recordStamp: record.stamp, staffStamp: privateRecord?.stamp || null };
  }).filter(lead => !closedCatering(lead.status)).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id));
  const items: BulkCloseItem[] = active.slice(0, bulkCloseLimit).map(({ id, name, date, status, version, recordStamp, staffStamp }) => ({ id, name, date, status, version, recordStamp, staffStamp }));
  return { totalActive: active.length, items };
}
