export const bookingStates = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no-show', 'needs-review'] as const;
export type BookingState = typeof bookingStates[number];
export type StaffAction = 'confirm' | 'seat' | 'complete' | 'cancel' | 'no-show';
export function bookingState(record: { status?: unknown; attendanceStatus?: unknown }): BookingState {
  const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'no-show' || record.attendanceStatus === 'no-show') return 'no-show';
  if (status === 'completed') return 'completed';
  if (status === 'seated' || record.attendanceStatus === 'show') return 'seated';
  if (status === 'confirmed') return 'confirmed';
  return !status || status === 'pending' ? 'pending' : 'needs-review';
}
export function transition(state: BookingState, action: StaffAction): BookingState {
  const next: Record<StaffAction, BookingState> = { confirm: 'confirmed', seat: 'seated', complete: 'completed', cancel: 'cancelled', 'no-show': 'no-show' };
  const allowed: Record<StaffAction, BookingState[]> = {
    confirm: ['pending'], seat: ['confirmed'], complete: ['seated'],
    cancel: ['pending', 'confirmed'], 'no-show': ['pending', 'confirmed'],
  };
  if (state === next[action]) return state;
  if (!allowed[action].includes(state)) throw new Error(`Cannot ${action} a ${state} reservation`);
  return next[action];
}
export const isGuestEditable = (state: BookingState) => state === 'pending' || state === 'confirmed';
export const statusLabels: Record<BookingState, string> = {
  pending: 'Awaiting restaurant acceptance', confirmed: 'Confirmed', seated: 'Seated',
  completed: 'Completed', cancelled: 'Cancelled', 'no-show': 'No-show', 'needs-review': 'Needs staff review',
};
