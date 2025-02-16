import { Suspense } from 'react';
import CancelReservationClient from '@/components/CancelReservationClient';
import Loading from '@/components/Loading';

interface PageProps {
    params: {
        id: string;
    };
    searchParams: { [key: string]: string | string[] | undefined };
}

export default function CancelReservationPage({ params }: PageProps) {
    return (
        <Suspense fallback={<Loading />}>
            <CancelReservationClient id={params.id} />
        </Suspense>
    );
} 