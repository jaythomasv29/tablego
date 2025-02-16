import CancelReservationClient from '@/components/CancelReservationClient';

interface PageProps {
    params: {
        id: string;
    };
}

export default async function CancelReservationPage({ params }: PageProps) {
    return <CancelReservationClient id={params.id} />;
} 