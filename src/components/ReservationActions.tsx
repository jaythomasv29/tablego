'use client';
import { useState } from 'react';
import NotificationStatus from './NotificationStatus';
import { Button } from './ui/button';
import { bookingState, type StaffAction } from '@/lib/reservations/domain';
import { staffReservationAction } from '@/lib/reservations/client';
export default function ReservationActions({ reservation, onUpdated }: {
  reservation: { id: string; status: string; attendanceStatus?: string; phone?: string };
  onUpdated: (record: { status: string; attendanceStatus?: 'show' | 'no-show' }) => void;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [confirmCancel, setConfirmCancel] = useState(false);
  const state = bookingState(reservation);
  const actions: { action: StaffAction; label: string }[] = [];
  if (state === 'pending') actions.push({ action: 'confirm', label: 'Confirm' });
  if (state === 'confirmed') actions.push({ action: 'seat', label: 'Seat' });
  if (state === 'seated') actions.push({ action: 'complete', label: 'Complete' });
  if (state === 'pending' || state === 'confirmed') actions.push({ action: 'no-show', label: 'No-show' }, { action: 'cancel', label: 'Cancel' });
  async function run(action: StaffAction) {
    if (action === 'cancel' && !confirmCancel) { setConfirmCancel(true); return; }
    setBusy(true); setError('');
    try {
      const result = await staffReservationAction(reservation.id, action);
      onUpdated({ status: result.status, attendanceStatus: result.status === 'seated' || result.status === 'completed' ? 'show' : result.status === 'no-show' ? 'no-show' : undefined });
      setConfirmCancel(false);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2" onClick={event => event.stopPropagation()}>
    {confirmCancel && <p className="text-xs" role="alert">Cancel this booking? Click Cancel again to confirm.</p>}
    <div className="flex flex-wrap gap-2">{actions.map(({ action, label }) => <Button key={action} size="sm" variant={action === 'cancel' && confirmCancel ? 'destructive' : 'outline'} disabled={busy} className="h-7 px-2 text-xs" onClick={() => run(action)}>{busy ? 'Saving…' : label}</Button>)}
      {confirmCancel && <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmCancel(false)}>Keep booking</Button>}
      {reservation.phone && <a className="inline-flex items-center rounded-md border px-2 text-xs" href={`tel:${reservation.phone.replace(/[^\d+]/g, '')}`}>Call</a>}
    </div><NotificationStatus reservationId={reservation.id} />{error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
