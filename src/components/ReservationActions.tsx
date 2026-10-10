'use client';
import { useState } from 'react';
import NotificationStatus from './NotificationStatus';
import { Button } from './ui/button';
import { bookingState, type StaffAction } from '@/lib/reservations/domain';
import { staffReservationAction } from '@/lib/reservations/client';
export default function ReservationActions({ reservation, onUpdated }: {
  reservation: { id: string; status: string; attendanceStatus?: string; phone?: string; canNoShow?: boolean };
  onUpdated: (record: { status: string; attendanceStatus?: 'show' | 'no-show' }) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmAction, setConfirmAction] = useState<StaffAction | null>(null);
  const state = bookingState(reservation);
  const actions: { action: StaffAction; label: string }[] = [];
  if (state === 'pending') actions.push({ action: 'confirm', label: 'Confirm' });
  if (state === 'confirmed') actions.push({ action: 'seat', label: 'Seat' });
  if (state === 'seated') actions.push({ action: 'complete', label: 'Complete' });
  if (state === 'confirmed' && reservation.canNoShow) actions.push({ action: 'no-show', label: 'No-show' });
  if (state === 'pending' || state === 'confirmed') actions.push({ action: 'cancel', label: 'Cancel' });
  async function run(action: StaffAction) {
    if ((action === 'cancel' || action === 'no-show') && confirmAction !== action) { setConfirmAction(action); return; }
    setBusy(true); setError('');
    try {
      const result = await staffReservationAction(reservation.id, action);
      onUpdated({ status: result.status, attendanceStatus: result.status === 'seated' || result.status === 'completed' ? 'show' : result.status === 'no-show' ? 'no-show' : undefined });
      setConfirmAction(null);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2" onClick={event => event.stopPropagation()}>
    {confirmAction && <p className="text-xs" role="alert">{confirmAction === 'cancel' ? 'Cancel this booking? Click Cancel again to confirm.' : 'Record a no-show? Click No-show again to confirm.'}</p>}
    <div className="flex flex-wrap gap-2">{actions.map(({ action, label }) => <Button key={action} size="sm" variant={action === confirmAction ? 'destructive' : 'outline'} disabled={busy} className="h-7 px-2 text-xs" onClick={() => run(action)}>{busy ? 'Saving…' : label}</Button>)}
      {confirmAction && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmAction(null)}>Keep current status</Button>}
      {reservation.phone && <a className="inline-flex items-center rounded-md border px-2 text-xs" href={`tel:${reservation.phone.replace(/[^\d+]/g, '')}`}>Call</a>}
    </div><NotificationStatus reservationId={reservation.id} />{error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
