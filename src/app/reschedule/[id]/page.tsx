'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Banner from '@/components/Banner';
import DatePicker from '@/components/DatePicker';
import { BusinessHours } from '@/components/ReservationForm';
import { useTimezone } from '@/contexts/TimezoneContext';
import { TimeSlot } from '@/types/TimeSlot';
import { CheckCircle2, CalendarDays, Clock, Users } from 'lucide-react';

interface Reservation {
    id: string;
    date: Timestamp | string | Date;
    time: string;
    name: string;
    guests: number;
    email: string;
    phone: string;
    status: string;
}

interface SpecialDate {
    date: string;
    reason: string;
    closureType?: 'full' | 'lunch' | 'dinner';
}

interface PageProps {
    params: Promise<{ id: string }>;
}

const SIAM_PALETTE = {
    primary: '#F9F7F2',
    accent: '#A3B18A',
    surface: '#EAE0D5',
    text: '#121212',
};

const getDateFromTimestamp = (date: Timestamp | string | Date): Date => {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Date(date + 'T12:00:00');
    }
    if (date && typeof date === 'object' && 'toDate' in date) {
        return (date as Timestamp).toDate();
    }
    if (typeof date === 'string') return new Date(date);
    return date as Date;
};

const formatReadableDate = (date: Date | string): string => {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [y, m, d] = date.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
        });
    }
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

// Handles both 24-hour "HH:MM" (business hours) and 12-hour "h:mm AM/PM" (slot) formats.
const timeToMinutes = (timeStr: string): number => {
    const [time, period] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
};

const isSameMonthAndDay = (d1: Date, d2: Date): boolean =>
    d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const getClosureType = (specialDate?: SpecialDate): 'full' | 'lunch' | 'dinner' | null => {
    if (!specialDate) return null;
    return specialDate.closureType || 'full';
};

// YYYY-MM-DD using the date's local calendar components (what the user picked on the calendar)
const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ReschedulePage({ params }: PageProps) {
    const { id } = use(params);
    const { timezone } = useTimezone();
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
    const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
    const [reservationCutoffMinutes, setReservationCutoffMinutes] = useState(60);
    const [minimumLeadTimeMinutes, setMinimumLeadTimeMinutes] = useState(50);

    const [selectedDate, setSelectedDate] = useState<Date>(() => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        return d;
    });
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);

    useEffect(() => {
        const load = async () => {
            try {
                const snap = await getDoc(doc(db, 'reservations', id));
                if (!snap.exists()) { setError('Reservation not found.'); return; }
                const data = { id: snap.id, ...snap.data() } as Reservation;
                setReservation(data);
                setSelectedTime(data.time);

                const dateObj = getDateFromTimestamp(data.date);
                dateObj.setHours(12, 0, 0, 0);
                setSelectedDate(dateObj);

                const [hoursDoc, generalDoc, specialSnap] = await Promise.all([
                    getDoc(doc(db, 'settings', 'businessHours')),
                    getDoc(doc(db, 'settings', 'general')),
                    getDocs(collection(db, 'specialDates')),
                ]);

                if (hoursDoc.exists()) setBusinessHours(hoursDoc.data() as BusinessHours);
                if (generalDoc.exists()) {
                    const g = generalDoc.data();
                    if (g.reservationCutoffMinutes !== undefined) setReservationCutoffMinutes(g.reservationCutoffMinutes);
                    if (g.minimumLeadTimeMinutes !== undefined) setMinimumLeadTimeMinutes(g.minimumLeadTimeMinutes);
                }
                setSpecialDates(specialSnap.docs.map((d) => d.data() as SpecialDate));
            } catch {
                setError('Failed to load reservation.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    const generateTimeSlots = (date: Date, hours: BusinessHours): TimeSlot[] => {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayHours = hours[days[date.getDay()]];
        if (!dayHours) return [];

        const matchingSpecialDate = specialDates.find((sd) => isSameMonthAndDay(date, new Date(sd.date)));
        const closureType = getClosureType(matchingSpecialDate);
        const lunchClosed = closureType === 'full' || closureType === 'lunch';
        const dinnerClosed = closureType === 'full' || closureType === 'dinner';

        const restaurantNow = new Date(new Date().toLocaleString('en-US', { timeZone: timezone }));
        const isToday = date.toDateString() === restaurantNow.toDateString();
        const currentMinutes = isToday ? restaurantNow.getHours() * 60 + restaurantNow.getMinutes() : 0;

        const slots: TimeSlot[] = [];
        const addPeriodSlots = (
            period: { isOpen: boolean; open: string; close: string; customRanges?: { start: string; end: string }[] },
            label: 'lunch' | 'dinner',
            closedBySpecialDate: boolean
        ) => {
            if (!period.isOpen || closedBySpecialDate) return;
            const ranges = period.customRanges?.length ? period.customRanges : [{ start: period.open, end: period.close }];
            ranges.forEach((range) => {
                let start = timeToMinutes(range.start);
                const end = timeToMinutes(range.end);
                if (isToday && end <= currentMinutes + reservationCutoffMinutes) return;
                if (isToday && start < currentMinutes) {
                    start = Math.ceil((currentMinutes + minimumLeadTimeMinutes) / 30) * 30;
                }
                for (let t = start; t <= end - reservationCutoffMinutes; t += 30) {
                    if (!isToday || t >= currentMinutes + minimumLeadTimeMinutes) {
                        slots.push({ time: minutesToTime(t), period: label });
                    }
                }
            });
        };

        addPeriodSlots(dayHours.lunch, 'lunch', lunchClosed);
        addPeriodSlots(dayHours.dinner, 'dinner', dinnerClosed);

        return slots.sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    };

    const filterBookedSlots = async (date: Date, slots: TimeSlot[]): Promise<TimeSlot[]> => {
        try {
            const targetDate = toDateKey(date);
            const q = query(collection(db, 'reservations'), where('date', '==', targetDate), where('status', '!=', 'cancelled'));
            const snap = await getDocs(q);
            const booked = snap.docs.filter((d) => d.id !== id).map((d) => d.data().time);
            return slots.filter((s) => !booked.includes(s.time));
        } catch {
            return slots;
        }
    };

    // Recompute slots whenever the selected date or scheduling settings change
    useEffect(() => {
        if (!businessHours) return;
        let active = true;
        (async () => {
            const base = generateTimeSlots(selectedDate, businessHours);
            const filtered = await filterBookedSlots(selectedDate, base);
            if (active) setAvailableTimeSlots(filtered);
        })();
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, businessHours, specialDates, reservationCutoffMinutes, minimumLeadTimeMinutes, timezone]);

    const handleUpdate = (date: Date, time: string) => {
        setSelectedDate(date);
        setSelectedTime(time);
    };

    const handleDateChange = (date: Date) => {
        setSelectedDate(date);
        setSelectedTime('');
    };

    const handleReschedule = async () => {
        if (!selectedDate || !selectedTime) { setError('Please select a date and time.'); return; }
        setSubmitting(true);
        setError(null);
        try {
            const dateStr = toDateKey(selectedDate);
            await updateDoc(doc(db, 'reservations', id), {
                date: dateStr,
                time: selectedTime,
                updatedAt: new Date().toISOString(),
                status: 'confirmed',
            });

            await fetch('/api/send-reschedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationId: reservation?.id,
                    email: reservation?.email,
                    name: reservation?.name,
                    date: dateStr,
                    time: selectedTime,
                    guests: reservation?.guests,
                    phone: reservation?.phone,
                }),
            });

            setSuccess(true);
        } catch {
            setError('Failed to reschedule. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <>
                <Banner />
                <Navbar />
                <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: SIAM_PALETTE.primary }}>
                    <div className="w-8 h-8 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                </div>
                <Footer />
            </>
        );
    }

    if (error && !reservation) {
        return (
            <>
                <Banner />
                <Navbar />
                <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: SIAM_PALETTE.primary }}>
                    <div className="text-center">
                        <p className="text-sm uppercase tracking-widest text-zinc-400 mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>Something went wrong</p>
                        <h1 className="text-3xl mb-6" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontStyle: 'italic' }}>{error}</h1>
                        <Link href="/" className="inline-block rounded-full px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:opacity-80" style={{ backgroundColor: SIAM_PALETTE.accent }}>
                            Return Home
                        </Link>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    if (success) {
        return (
            <>
                <Banner />
                <Navbar />
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="min-h-screen flex items-center justify-center px-4 py-20"
                    style={{ backgroundColor: SIAM_PALETTE.primary }}
                >
                    <div className="w-full max-w-md text-center">
                        <div
                            className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                            style={{ backgroundColor: `${SIAM_PALETTE.accent}33` }}
                        >
                            <CheckCircle2 className="w-10 h-10" style={{ color: SIAM_PALETTE.accent }} />
                        </div>
                        <p className="text-xs uppercase tracking-[0.16em] mb-2" style={{ fontFamily: 'Inter, sans-serif', color: SIAM_PALETTE.accent }}>
                            All set
                        </p>
                        <h2 className="text-3xl mb-4" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontStyle: 'italic' }}>
                            Reservation updated.
                        </h2>
                        <p className="text-zinc-500 text-sm leading-relaxed mb-8" style={{ fontFamily: 'Inter, sans-serif' }}>
                            A confirmation has been sent to your inbox with the new details.
                        </p>
                        <div
                            className="rounded-2xl border p-4 text-sm mb-8"
                            style={{ borderColor: `${SIAM_PALETTE.accent}55`, backgroundColor: `${SIAM_PALETTE.accent}18`, fontFamily: 'Inter, sans-serif' }}
                        >
                            <p className="font-medium text-zinc-800">{formatReadableDate(selectedDate)}</p>
                            <p className="text-zinc-500 mt-1">{selectedTime} · {reservation?.guests} {reservation?.guests === 1 ? 'guest' : 'guests'}</p>
                        </div>
                        <Link
                            href="/"
                            className="inline-block rounded-full px-7 py-2.5 text-sm font-medium text-zinc-900 transition-opacity hover:opacity-80"
                            style={{ backgroundColor: SIAM_PALETTE.accent, fontFamily: 'Inter, sans-serif' }}
                        >
                            Return Home
                        </Link>
                    </div>
                </motion.div>
                <Footer />
            </>
        );
    }

    return (
        <>
            <Banner />
            <Navbar />
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="min-h-screen flex items-center justify-center px-4 py-24"
                style={{ backgroundColor: SIAM_PALETTE.primary }}
            >
                <div className="w-full max-w-md">
                    {/* Header */}
                    <div className="mb-8">
                        <p className="text-xs uppercase tracking-[0.16em] mb-2" style={{ fontFamily: 'Inter, sans-serif', color: SIAM_PALETTE.accent }}>
                            Modify reservation
                        </p>
                        <h1 className="text-4xl leading-tight" style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontStyle: 'italic', color: SIAM_PALETTE.text }}>
                            Reschedule your table.
                        </h1>
                    </div>

                    {/* Current booking card */}
                    {reservation && (
                        <div className="rounded-2xl p-5 mb-6" style={{ backgroundColor: SIAM_PALETTE.surface }}>
                            <p className="text-xs uppercase tracking-[0.12em] mb-3" style={{ fontFamily: 'Inter, sans-serif', color: SIAM_PALETTE.accent }}>
                                Current booking
                            </p>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2.5 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: SIAM_PALETTE.text }}>
                                    <CalendarDays className="w-4 h-4 shrink-0" style={{ color: SIAM_PALETTE.accent }} />
                                    <span>{formatReadableDate(getDateFromTimestamp(reservation.date))}</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: SIAM_PALETTE.text }}>
                                    <Clock className="w-4 h-4 shrink-0" style={{ color: SIAM_PALETTE.accent }} />
                                    <span>{reservation.time}</span>
                                </div>
                                <div className="flex items-center gap-2.5 text-sm" style={{ fontFamily: 'Inter, sans-serif', color: SIAM_PALETTE.text }}>
                                    <Users className="w-4 h-4 shrink-0" style={{ color: SIAM_PALETTE.accent }} />
                                    <span>{reservation.guests} {reservation.guests === 1 ? 'guest' : 'guests'}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <div className="space-y-5">
                        <DatePicker
                            date={selectedDate}
                            time={selectedTime}
                            onUpdate={handleUpdate}
                            onDateChange={handleDateChange}
                            availableTimeSlots={availableTimeSlots}
                            specialDates={specialDates}
                        />

                        {error && (
                            <p className="text-sm text-red-500" style={{ fontFamily: 'Inter, sans-serif' }}>{error}</p>
                        )}

                        <button
                            onClick={handleReschedule}
                            disabled={!selectedDate || !selectedTime || submitting}
                            className="w-full rounded-full py-3 text-sm font-medium transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: SIAM_PALETTE.accent,
                                color: SIAM_PALETTE.text,
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            {submitting ? (
                                <span className="inline-flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                                    Updating...
                                </span>
                            ) : 'Confirm New Time'}
                        </button>
                    </div>
                </div>
            </motion.div>
            <Footer />
        </>
    );
}
