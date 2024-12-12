export type TimeSlot = {
    startTime: Date;
    endTime: Date;
    period: 'lunch' | 'dinner';
    time: string;
};
