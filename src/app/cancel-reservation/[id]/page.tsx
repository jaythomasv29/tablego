import CancelReservationClient from '@/components/CancelReservationClient';

type Props = {
    params: { id: string }
}

// Remove async since we're not doing any server-side data fetching
export default function CancelReservationPage({ params }: Props) {
    return (
        <CancelReservationClient id={params.id} />
    );
} 