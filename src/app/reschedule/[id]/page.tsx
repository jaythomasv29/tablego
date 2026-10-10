import ManageReservation from '@/components/ManageReservation';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ManageReservation id={id} initialAction="reschedule" />;
}
