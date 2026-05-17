'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc, updateDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Banner from '@/components/Banner';
import { BusinessHours } from '@/components/ReservationForm';
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

interface TimeSlot {
    time: string;
    period: 'lunch' | 'dinner';
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

const generateTimeSlots = async (date: Date, reservationId: string): Promise<string[]> => {
    try {
        const pstDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        const dayName = pstDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Los_Angeles' }).toLowerCase();

        const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
        if (!hoursDoc.exists()) return [];
        const businessHours = hoursDoc.data() as BusinessHours;
        const dayHours = businessHours[dayName];
        if (!dayHours) return [];

        const pstNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
        const isToday = pstDate.toDateString() === pstNow.toDateString();
        const currentMinutes = isToday ? pstNow.getHours() * 60 + pstNow.getMinutes() : 0;

        const slots: string[] = [];
        const addSlots = (open: string, close: string) => {
            const start = timeToMinutes(open);
            const end = timeToMinutes(close) - 30;
            const adjustedStart = isToday ? Math.max(start, currentMinutes + 30) : start;
            for (let t = adjustedStart; t <= end; t += 30) {
                slots.push(minutesToTime(t));
            }
        };

        if (dayHours.lunch?.isOpen) addSlots(dayHours.lunch.open, dayHours.lunch.close);
        if (dayHours.dinner?.isOpen) addSlots(dayHours.dinner.open, dayHours.dinner.close);

        // Filter out already-booked times
        const targetDate = date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
        const q = query(collection(db, 'reservations'), where('date', '==', targetDate), where('status', '!=', 'cancelled'));
        const snap = await getDocs(q);
        const booked = snap.docs.filter(d => d.id !== reservationId).map(d => d.data().time);

        return slots.filter(t => !booked.includes(t)).sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
    } catch {
        return [];
    }
};

export default function ReschedulePage({ params }: PageProps) {
    const { id } = use(params);
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

    useEffect(() => {
        const fetchReservation = async () => {
            try {
                const snap = await getDoc(doc(db, 'reservations', id));
                if (!snap.exists()) { setError('Reservation not found.'); return; }
                const data = { id: snap.id, ...snap.data() } as Reservation;
                setReservation(data);

                const date = getDateFromTimestamp(data.date);
                const dateStr = date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
                setSelectedDate(dateStr);
                setSelectedTime(data.time);

                const slots = await generateTimeSlots(date, id);
                setAvailableTimeSlots(slots);
            } catch {
                setError('Failed to load reservation.');
            } finally {
                setLoading(false);
            }
        };
        fetchReservation();
    }, [id]);

    const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSelectedDate(val);
        setSelectedTime('');
        if (!val) { setAvailableTimeSlots([]); return; }
        const [y, m, d] = val.split('-').map(Number);
        const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const slots = await generateTimeSlots(date, id);
        setAvailableTimeSlots(slots);
    };

    const handleReschedule = async () => {
        if (!selectedDate || !selectedTime) { setError('Please select a date and time.'); return; }
        setSubmitting(true);
        setError(null);
        try {
            await updateDoc(doc(db, 'reservations', id), {
                date: selectedDate,
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
                    date: selectedDate,
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

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

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
                        {/* Date picker */}
                        <div>
                            <label className="block text-xs uppercase tracking-[0.12em] mb-2" style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}>
                                New date
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                min={todayStr}
                                onChange={handleDateChange}
                                className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all"
                                style={{
                                    fontFamily: 'Inter, sans-serif',
                                    backgroundColor: '#ffffff',
                                    borderColor: '#e4e4e4',
                                    color: SIAM_PALETTE.text,
                                }}
                                onFocus={e => (e.target.style.borderColor = SIAM_PALETTE.accent)}
                                onBlur={e => (e.target.style.borderColor = '#e4e4e4')}
                            />
                        </div>

                        {/* Time slots */}
                        <div>
                            <label className="block text-xs uppercase tracking-[0.12em] mb-2" style={{ fontFamily: 'Inter, sans-serif', color: '#6b6b6b' }}>
                                New time
                            </label>
                            {selectedDate && availableTimeSlots.length === 0 ? (
                                <p className="text-sm text-zinc-400 py-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                                    No available slots for this date. Please try another day.
                                </p>
                            ) : (
                                <div className="grid grid-cols-4 gap-2">
                                    {availableTimeSlots.map(time => (
                                        <button
                                            key={time}
                                            type="button"
                                            onClick={() => setSelectedTime(time)}
                                            className="rounded-lg py-2 text-xs font-medium transition-all"
                                            style={{
                                                fontFamily: 'Inter, sans-serif',
                                                backgroundColor: selectedTime === time ? SIAM_PALETTE.accent : '#ffffff',
                                                color: selectedTime === time ? SIAM_PALETTE.text : '#4b4b4b',
                                                border: `1px solid ${selectedTime === time ? SIAM_PALETTE.accent : '#e4e4e4'}`,
                                            }}
                                        >
                                            {time}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

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
