import type { BookingState } from '@/lib/reservations/domain';

export default function ReservationMoment({ status }: { status?: BookingState }) {
  const confirmed = status === 'confirmed';
  const quiet = status === 'cancelled' || status === 'no-show' || status === 'completed';
  return <div className={`reservation-moment ${quiet ? 'reservation-moment-quiet' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 260 140" width="224" height="120" fill="none" style={{ width: 224, height: 120, maxWidth: '100%', margin: '0 auto' }} focusable="false">
      <ellipse cx="130" cy="124" rx="62" ry="5" fill="#A3B18A" opacity=".1" />
      <g className="reservation-place-setting" stroke="#A3B18A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="130" cy="66" r="49" opacity=".5" />
        <circle cx="130" cy="66" r="40" opacity=".85" />
        <circle cx="130" cy="66" r="33" opacity=".2" />
        <path d="M63 33v21c0 7 14 7 14 0V33M70 33v71M63 44h14M190 104V33c-8 5-10 19-10 30h10" />
        {confirmed ? <path className="reservation-illustration-draw" d="m117 67 9 9 19-20" stroke="#F9F7F2" strokeWidth="2.5" />
          : status === 'pending' ? <g stroke="#F9F7F2"><circle cx="130" cy="66" r="12" /><path d="M130 59v8l5 3" /></g>
          : <path d="M117 68c7-10 19-10 26 0M121 74h18" opacity=".6" />}
        <g className="reservation-illustration-draw" opacity=".65"><path d="M211 37c-6-8-4-18 3-23 6 8 5 18-3 23ZM211 37c-10 0-17-6-18-14 10-1 18 5 18 14ZM211 37l-5 14M48 88c-8 0-14 5-15 12 9 1 15-4 15-12ZM48 88l5 15" /></g>
        <path d="M38 40v8M34 44h8M220 85v6M217 88h6" opacity=".4" />
      </g>
    </svg>
  </div>;
}
