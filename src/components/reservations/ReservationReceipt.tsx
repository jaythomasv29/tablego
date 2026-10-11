import type { BookingState } from '@/lib/reservations/domain';
import { formatDateForDisplay } from '@/utils/dateUtils';
export interface ReceiptDetails { name: string; date: string; time: string; guests: number; timezone: string; status: BookingState }
export function ReservationReceipt({ details }: { details: ReceiptDetails }) {
  return <>
    <h4 className="text-3xl italic font-normal text-zinc-900" style={{ fontFamily: 'var(--font-editorial), Georgia, serif' }}>{details.status === 'confirmed' ? 'Your table is confirmed' : details.status === 'pending' ? 'Your table request is in' : 'Your reservation is saved'}</h4>
    <p className="mt-3 text-zinc-600 leading-relaxed">Thank you, {details.name || 'guest'}. {details.status === 'confirmed' ? 'We look forward to welcoming you. Use your secure link to let the restaurant know you’re coming or to change your plans.' : details.status === 'pending' ? 'Your request awaits restaurant acceptance.' : 'Check your secure link for the latest reservation status.'}</p>
    <div className="mt-6 rounded-2xl border border-[#A3B18A]/40 bg-[#EAE0D5] p-4 text-sm text-zinc-700">
      {formatDateForDisplay(details.date)} at {details.time} · {details.guests} {details.guests === 1 ? 'guest' : 'guests'}
      <p className="mt-2 text-sm">Restaurant local time · {details.timezone}</p>
    </div>
  </>;
}
