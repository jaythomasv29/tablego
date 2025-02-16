import { Suspense } from 'react';
import CancelReservationClient from '@/components/CancelReservationClient';
import Loading from '@/components/Loading';

export default function CancelReservationPage({
    params
}: {
    params: { id: string }
}) {
    return (
        <Suspense fallback={<Loading />}>
            <CancelReservationClient id={params.id} />
        </Suspense>
    );
} 