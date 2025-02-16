'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Banner from '@/components/Banner';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { BusinessHours } from '@/components/ReservationForm';

interface Reservation {
    id: string;
    date: {
        toDate: () => Date;
    } | Timestamp | string;  // Updated type to handle all possible date formats
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
}

interface TimeSlot {
    time: string;
    period: 'lunch' | 'dinner';
}

const slotDuration = 30;

// Add helper function to handle date conversion
const getDateFromTimestamp = (date: Reservation['date']): Date => {
    if (typeof date === 'string') {
        return new Date(date);
    }
    if (date instanceof Timestamp) {
        return date.toDate();
    }
    return date.toDate();
};

interface PageProps {
    params: Promise<{ id: string }>;
}

// Add this helper function to check if a time is in the future with buffer
const isTimeInFutureWithBuffer = (time: string, bufferHours: number = 2): boolean => {
    const [timeValue, period] = time.split(' ');
    const [hours, minutes] = timeValue.split(':');

    const reservationTime = new Date();
    let hour = parseInt(hours);

    // Convert to 24 hour format
    if (period === 'PM' && hour !== 12) {
        hour += 12;
    } else if (period === 'AM' && hour === 12) {
        hour = 0;
    }

    reservationTime.setHours(hour, parseInt(minutes), 0, 0);

    const currentTime = new Date();
    const bufferTime = bufferHours * 60 * 60 * 1000; // Convert hours to milliseconds

    return reservationTime.getTime() > (currentTime.getTime() + bufferTime);
};

// Add this interface for business hours
interface BusinessDay {
    lunch: {
        start: string;
        end: string;
        isClosed: boolean;
    };
    dinner: {
        start: string;
        end: string;
        isClosed: boolean;
    };
    isHoliday: boolean;
    holidayName?: string;
}

// Update generateTimeSlots function
const generateTimeSlots = async (date: Date) => {
    try {
        const dateString = date.toLocaleDateString('en-US', {
            weekday: 'long',
            timeZone: "America/Los_Angeles"
        }).toLowerCase();

        const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
        if (!hoursDoc.exists()) {
            throw new Error('Business hours not found');
        }

        const businessHours = hoursDoc.data() as BusinessHours;
        const dayHours = businessHours[dateString];
        if (!dayHours) return [];

        const slots: TimeSlot[] = [];
        const pstNow = new Date();
        const isToday = date.toDateString() === pstNow.toDateString();
        const currentMinutes = isToday ? pstNow.getHours() * 60 + pstNow.getMinutes() : 0;

        // Process lunch hours
        if (dayHours.lunch.isOpen) {
            let start = timeToMinutes(dayHours.lunch.open);
            const end = timeToMinutes(dayHours.lunch.close) - 30; // Subtract 30 minutes from closing time

            if (isToday && start < currentMinutes) {
                start = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
            }

            for (let time = start; time <= end - slotDuration; time += slotDuration) {
                if (!isToday || time >= currentMinutes + 30) {
                    slots.push({
                        time: minutesToTime(time),
                        period: 'lunch'
                    });
                }
            }
        }

        // Process dinner hours
        if (dayHours.dinner.isOpen) {
            let start = timeToMinutes(dayHours.dinner.open);
            const end = timeToMinutes(dayHours.dinner.close) - 30; // Subtract 30 minutes from closing time

            if (isToday && start < currentMinutes) {
                start = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
            }

            for (let time = start; time <= end - slotDuration; time += slotDuration) {
                if (!isToday || time >= currentMinutes + 30) {
                    slots.push({
                        time: minutesToTime(time),
                        period: 'dinner'
                    });
                }
            }
        }

        return slots.map(slot => slot.time);
    } catch (error) {
        console.error('Error generating time slots:', error);
        return [];
    }
};

// Add helper functions
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

export default function ReschedulePage({ params }: PageProps) {
    const { id } = use(params);
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);

    useEffect(() => {
        const fetchReservation = async () => {
            try {
                const reservationDoc = await getDoc(doc(db, 'reservations', id));
                if (!reservationDoc.exists()) {
                    setError('Reservation not found');
                    return;
                }

                const data = reservationDoc.data();
                const reservationData = {
                    id: reservationDoc.id,
                    ...data
                } as Reservation;

                setReservation(reservationData);
                const reservationDate = getDateFromTimestamp(data.date);
                setSelectedDate(reservationDate);
                setSelectedTime(data.time);
                fetchAvailableTimeSlots(reservationDate);
            } catch (err) {
                console.error('Error fetching reservation:', err);
                setError('Failed to load reservation');
            } finally {
                setLoading(false);
            }
        };

        fetchReservation();
    }, [id]);

    const handleReschedule = async () => {
        if (!selectedDate || !selectedTime) {
            setError('Please select both date and time');
            return;
        }

        try {
            setLoading(true);
            // Format the date to match "2025-02-16T22:01:32.590Z" format
            const formattedDate = new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                12, // Set to noon to avoid timezone issues
                0,
                0
            ).toISOString();

            await updateDoc(doc(db, 'reservations', id), {
                date: formattedDate, // Save as ISO string instead of Timestamp
                time: selectedTime, // Already in correct format (e.g., "6:30 PM")
                updatedAt: new Date().toISOString(),
                status: 'confirmed'
            });

            // Send rescheduling confirmation email
            await fetch('/api/send-reschedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reservationId: reservation?.id,
                    email: reservation?.email,
                    name: reservation?.name,
                    date: formattedDate,
                    time: selectedTime,
                    guests: reservation?.guests,
                    phone: reservation?.phone
                }),
            });

            setSuccess(true);
        } catch (err) {
            console.error('Error rescheduling:', err);
            setError('Failed to reschedule reservation');
        } finally {
            setLoading(false);
        }
    };

    const fetchAvailableTimeSlots = async (date: Date) => {
        const allTimeSlots = await generateTimeSlots(date);
        const availableSlots = await checkTimeSlotAvailability(date, allTimeSlots);

        if (reservation &&
            date.toDateString() === getDateFromTimestamp(reservation.date).toDateString()) {
            if (!availableSlots.includes(reservation.time)) {
                availableSlots.push(reservation.time);
            }
        }

        // Sort time slots
        availableSlots.sort((a, b) => {
            const timeA = new Date(`1970/01/01 ${a}`).getTime();
            const timeB = new Date(`1970/01/01 ${b}`).getTime();
            return timeA - timeB;
        });

        setAvailableTimeSlots(availableSlots);
    };

    const handleDateChange = (newDate: Date | null) => {
        setSelectedDate(newDate);
        setSelectedTime('');
        if (newDate) {
            fetchAvailableTimeSlots(newDate);
        }
    };

    const checkTimeSlotAvailability = async (date: Date, timeSlots: string[]) => {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        try {
            const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
            if (!hoursDoc.exists()) {
                throw new Error('Business hours not found');
            }

            const data = hoursDoc.data();
            const businessHours = {
                lunch: {
                    start: data?.lunch?.start || "11:00 AM",
                    end: data?.lunch?.end || "2:30 PM"
                },
                dinner: {
                    start: data?.dinner?.start || "5:00 PM",
                    end: data?.dinner?.end || "10:00 PM"
                }
            };

            // Convert business hours to minutes for accurate comparison
            const convertTimeToMinutes = (time: string) => {
                const [timeStr, period] = time.split(' ');
                const [hours, minutes] = timeStr.split(':').map(Number);
                let totalMinutes = hours * 60 + minutes;
                if (period === 'PM' && hours !== 12) totalMinutes += 12 * 60;
                if (period === 'AM' && hours === 12) totalMinutes = minutes;
                return totalMinutes;
            };

            const lunchStart = convertTimeToMinutes(businessHours.lunch.start);
            const lunchEnd = convertTimeToMinutes(businessHours.lunch.end);
            const dinnerStart = convertTimeToMinutes(businessHours.dinner.start);
            const dinnerEnd = convertTimeToMinutes(businessHours.dinner.end);

            // Get all reservations for the day
            const reservationsRef = collection(db, 'reservations');
            const q = query(
                reservationsRef,
                where('date', '>=', Timestamp.fromDate(startOfDay)),
                where('date', '<=', Timestamp.fromDate(endOfDay))
            );

            const querySnapshot = await getDocs(q);
            const bookedTimes = querySnapshot.docs
                .filter(doc => doc.id !== id && doc.data().status !== 'cancelled')
                .map(doc => doc.data().time);

            // Filter available time slots
            return timeSlots.filter(time => {
                const timeInMinutes = convertTimeToMinutes(time);
                const isLunchHour = timeInMinutes >= lunchStart && timeInMinutes <= lunchEnd;
                const isDinnerHour = timeInMinutes >= dinnerStart && timeInMinutes <= dinnerEnd;

                return !bookedTimes.includes(time) && (isLunchHour || isDinnerHour);
            });
        } catch (error) {
            console.error('Error checking availability:', error);
            return [];
        }
    };

    // Helper function to convert 12-hour time to 24-hour format
    const convertTo24Hour = (time12h: string) => {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');

        let hoursNumber = parseInt(hours, 10);
        if (modifier === 'PM' && hoursNumber < 12) {
            hoursNumber += 12;
        }
        if (modifier === 'AM' && hoursNumber === 12) {
            hoursNumber = 0;
        }

        return `${hoursNumber.toString().padStart(2, '0')}:${minutes}`;
    };

    if (loading) {
        return (
            <>
                <Navbar />
                <Banner />
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                </div>
                <Footer />
            </>
        );
    }

    if (error) {
        return (
            <>
                <Banner />
                <Navbar />
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">{error}</h1>
                        <Link href="/" className="text-indigo-600 hover:text-indigo-800">
                            Return to Homepage
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
                <Navbar />
                <Banner />
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="min-h-screen flex items-center justify-center px-4"
                >
                    <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
                        <svg className="w-16 h-16 text-green-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Reservation Updated</h2>
                        <p className="text-gray-600 mb-6">
                            Your reservation has been successfully rescheduled. A confirmation email has been sent to your inbox.
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg mb-6">
                            <p className="text-gray-600">New Reservation Details:</p>
                            <p className="font-medium text-gray-900">
                                {selectedDate?.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </p>
                            <p className="text-gray-600">{selectedTime}</p>
                        </div>
                        <Link
                            href="/"
                            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Return to Homepage
                        </Link>
                    </div>
                </motion.div>
                <Footer />
            </>
        );
    }

    return (
        <>
            <Navbar />
            <Banner />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-screen flex items-center justify-center px-4"
            >
                <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Reschedule Reservation</h2>
                    {reservation && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <h3 className="font-medium text-gray-900 mb-2">Current Reservation</h3>
                                <p className="text-gray-600">
                                    {getDateFromTimestamp(reservation.date).toLocaleDateString('en-US', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </p>
                                <p className="text-gray-600">{reservation.time}</p>
                                <p className="text-gray-600">{reservation.guests} guests</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select New Date
                                    </label>
                                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                                        <MuiDatePicker
                                            value={selectedDate}
                                            onChange={handleDateChange}
                                            minDate={new Date()}
                                            className="w-full"
                                        />
                                    </LocalizationProvider>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Select New Time
                                    </label>
                                    <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                                        {availableTimeSlots.map((time) => (
                                            <button
                                                key={time}
                                                onClick={() => setSelectedTime(time)}
                                                className={`px-3 py-2 rounded-lg text-sm font-medium
                                                    ${selectedTime === time
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {time}
                                            </button>
                                        ))}
                                    </div>
                                    {availableTimeSlots.length === 0 && selectedDate && (
                                        <p className="text-sm text-gray-500 mt-2">
                                            No available time slots for this date. Please select another date.
                                        </p>
                                    )}
                                </div>

                                {error && (
                                    <p className="text-red-600 text-sm">{error}</p>
                                )}

                                <button
                                    onClick={handleReschedule}
                                    disabled={!selectedDate || !selectedTime || loading}
                                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg 
                                             hover:bg-indigo-700 transition-colors disabled:bg-gray-300 
                                             disabled:cursor-not-allowed"
                                >
                                    {loading ? 'Updating...' : 'Confirm New Time'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
            <Footer />
        </>
    );
} 