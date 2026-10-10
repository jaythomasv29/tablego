export async function staffReservationAction(id: string, action: string) {
  const response = await fetch(`/api/staff/reservations/${encodeURIComponent(id)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to update reservation');
  return result.reservation;
}
