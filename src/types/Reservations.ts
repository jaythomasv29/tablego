export interface ReservationData {
    id: string;
    startDate: Date;
    endDate: Date;
    guestName: string;
    status: 'pending' | 'confirmed' | 'cancelled';
}
