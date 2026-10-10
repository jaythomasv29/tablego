import React from 'react';
import Link from 'next/link';
export const CancelButton: React.FC<{ reservationId: string; onSuccess?: () => void }> = ({ reservationId }) => (
  <Link href={`/reservation/${encodeURIComponent(reservationId)}`} className="inline-flex rounded-lg border px-6 py-3 text-sm font-medium">Manage reservation</Link>
);
