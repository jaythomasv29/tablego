import ManageReservation from './ManageReservation';
export default function CancelReservationClient({ id }: { id: string }) {
  return <ManageReservation id={id} initialAction="cancel" />;
}
