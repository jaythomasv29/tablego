import { formatDateForDisplay } from '@/utils/dateUtils';
export interface ReceiptDetails { name: string; date: string; time: string; guests: number; timezone: string }
export function ReservationReceipt({ details }: { details: ReceiptDetails }) {
  return <>
    <h4 className="text-2xl font-semibold text-zinc-900" style={{ fontFamily: 'var(--font-editorial), serif' }}>Your table request is in</h4>
    <p className="mt-3 text-zinc-600 leading-relaxed">Thank you, {details.name || 'guest'}. Your request awaits restaurant acceptance; email delivery may be delayed.</p>
    <div className="mt-6 rounded-2xl border border-[#A3B18A]/40 bg-[#A3B18A]/10 p-4 text-sm text-zinc-700">
      {formatDateForDisplay(details.date)} at {details.time} · {details.guests} {details.guests === 1 ? 'guest' : 'guests'}
      <p className="mt-2 text-sm">Restaurant local time · {details.timezone}</p>
    </div>
  </>;
}
