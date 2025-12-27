'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Banner from '@/components/Banner';
import { useRouter } from 'next/navigation';

interface Reservation {
    id: string;
    date: {
        toDate: () => Date;
    } | string;
    time: string;
    name: string;
    guests: number;
    email: string;
    status: string;
    confirmedAt?: string;
    cancelledAt?: string;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

const formatDate = (date: Reservation['date']) => {
    // If it's already a YYYY-MM-DD string, parse it directly to avoid timezone shifts
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-').map(Number);
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        return d.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC'
        });
    }

    if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    return date.toDate().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Add this helper function to get status badge styles
const getStatusBadge = (status: string) => {
    switch (status) {
        case 'confirmed':
            return 'bg-green-100 text-green-800';
        case 'cancelled':
            return 'bg-red-100 text-red-800';
        case 'pending':
            return 'bg-yellow-100 text-yellow-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
};

// Add this helper function to get formatted status text
const getStatusText = (status: string) => {
    switch (status) {
        case 'confirmed':
            return 'Confirmed';
        case 'cancelled':
            return 'Cancelled';
        case 'pending':
            return 'Pending';
        default:
            return 'Unknown';
    }
};

export default function ReservationManagementPage({ params }: PageProps) {
    const { id } = use(params);
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [actionCompleted, setActionCompleted] = useState<'confirmed' | 'cancelled' | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchReservation = async () => {
            try {
                const reservationDoc = await getDoc(doc(db, 'reservations', id));
                if (!reservationDoc.exists()) {
                    setError('Reservation not found');
                } else {
                    const data = reservationDoc.data();
                    setReservation({
                        id: reservationDoc.id,
                        ...data
                    } as Reservation);
                }
            } catch (err) {
                setError('Failed to load reservation');
            } finally {
                setLoading(false);
            }
        };

        fetchReservation();
    }, [id]);

    const handleConfirmation = async () => {
        try {
            setLoading(true);
            await updateDoc(doc(db, 'reservations', id), {
                status: 'confirmed',
                confirmedAt: new Date().toISOString()
            });
            setActionCompleted('confirmed');
        } catch (err) {
            setError('Failed to confirm reservation');
        } finally {
            setLoading(false);
        }
    };

    const handleCancellation = async () => {
        try {
            setLoading(true);
            await updateDoc(doc(db, 'reservations', id), {
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            });

            // Send cancellation email
            await fetch('/api/send-cancellation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reservationId: reservation?.id,
                    email: reservation?.email,
                    name: reservation?.name,
                    date: typeof reservation?.date === 'string'
                        ? reservation.date
                        : reservation?.date.toDate().toISOString(),
                    time: reservation?.time,
                    guests: reservation?.guests
                }),
            });

            setActionCompleted('cancelled');
        } catch (err) {
            setError('Failed to cancel reservation');
        } finally {
            setLoading(false);
        }
    };

    const handleReschedule = () => {
        router.push(`/reschedule/${id}`);
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

    if (actionCompleted) {
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
                        <svg
                            className={`w-16 h-16 mx-auto mb-4 ${actionCompleted === 'confirmed' ? 'text-green-500' : 'text-red-500'
                                }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d={actionCompleted === 'confirmed'
                                    ? "M5 13l4 4L19 7"
                                    : "M6 18L18 6M6 6l12 12"
                                }
                            />
                        </svg>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">
                            {actionCompleted === 'confirmed'
                                ? 'Reservation Confirmed'
                                : 'Reservation Cancelled'
                            }
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {actionCompleted === 'confirmed'
                                ? 'Thank you for confirming your reservation. We look forward to serving you!'
                                : 'Your reservation has been cancelled. We hope to see you another time!'
                            }
                        </p>
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
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Manage Your Reservation</h2>
                    {reservation && (
                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-medium text-gray-900">{reservation.name}</p>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(reservation.status)}`}>
                                        {getStatusText(reservation.status)}
                                    </span>
                                </div>
                                <p className="text-gray-600">
                                    {formatDate(reservation.date)}
                                </p>
                                <p className="text-gray-600">{reservation.time}</p>
                                <p className="text-gray-600">{reservation.guests} guests</p>

                                {/* Show confirmation/cancellation time if available */}
                                {reservation.confirmedAt && (
                                    <p className="text-xs text-green-600 mt-2">
                                        Confirmed at: {new Date(reservation.confirmedAt).toLocaleString()}
                                    </p>
                                )}
                                {reservation.cancelledAt && (
                                    <p className="text-xs text-red-600 mt-2">
                                        Cancelled at: {new Date(reservation.cancelledAt).toLocaleString()}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Only show action buttons if not cancelled */}
                    {reservation && reservation.status !== 'cancelled' && (
                        <div className="space-y-3">
                            {reservation.status !== 'confirmed' && (
                                <button
                                    onClick={handleConfirmation}
                                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    Confirm Reservation
                                </button>
                            )}
                            <button
                                onClick={handleReschedule}
                                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                            >
                                Reschedule
                            </button>
                            {reservation.status !== 'cancelled' && (
                                <button
                                    onClick={handleCancellation}
                                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    Cancel Reservation
                                </button>
                            )}
                        </div>
                    )}

                    {/* Show message if reservation is cancelled */}
                    {reservation && reservation.status === 'cancelled' && (
                        <div className="text-center text-gray-600">
                            <p>This reservation has been cancelled.</p>
                            <Link
                                href="/"
                                className="inline-block mt-4 text-indigo-600 hover:text-indigo-800"
                            >
                                Make a New Reservation
                            </Link>
                        </div>
                    )}
                </div>
            </motion.div>
            <Footer />
        </>
    );
} 