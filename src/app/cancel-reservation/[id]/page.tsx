'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Banner from '@/components/Banner';

export default function CancelReservationPage({
    params
}: {
    params: { id: string } & { [key: string]: string | string[] }
}) {
    const [reservation, setReservation] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cancelled, setCancelled] = useState(false);

    useEffect(() => {
        const fetchReservation = async () => {
            try {
                const reservationDoc = await getDoc(doc(db, 'reservations', params.id));
                if (!reservationDoc.exists()) {
                    setError('Reservation not found');
                } else {
                    const reservationData = reservationDoc.data();
                    setReservation({
                        id: reservationDoc.id,
                        ...reservationData
                    });
                    // Set cancelled state if reservation is already cancelled
                    if (reservationData.status === 'cancelled') {
                        setCancelled(true);
                    }
                }
            } catch (err) {
                setError('Failed to load reservation');
            } finally {
                setLoading(false);
            }
        };

        fetchReservation();
    }, [params.id]);

    const handleCancellation = async () => {
        try {
            setLoading(true);

            // Update the reservation status to cancelled
            await updateDoc(doc(db, 'reservations', params.id), {
                status: 'cancelled',
                cancelledAt: new Date().toISOString()
            });

            // Send cancellation confirmation email
            await fetch('/api/send-cancellation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reservationId: params.id,
                    email: reservation.email,
                    name: reservation.name,
                    date: reservation.date,
                    time: reservation.time,
                    guests: reservation.guests
                }),
            });

            setCancelled(true);
        } catch (err) {
            setError('Failed to cancel reservation');
        } finally {
            setLoading(false);
        }
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

    if (cancelled) {
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
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"></path>
                        </svg>
                        <h2 className="text-2xl font-bold text-gray-900 mb-4">Reservation Cancelled</h2>
                        <p className="text-gray-600 mb-6">
                            {reservation?.status === 'cancelled'
                                ? 'This reservation has already been cancelled.'
                                : 'Your reservation has been successfully cancelled. A confirmation email has been sent to your inbox.'
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
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">Cancel Reservation</h2>
                    <div className="space-y-4 mb-6">
                        <p className="text-gray-600">
                            Are you sure you want to cancel your reservation for:
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                            <p className="font-medium text-gray-900">{reservation.name}</p>
                            <p className="text-gray-600">{new Date(reservation.date).toLocaleDateString()}</p>
                            <p className="text-gray-600">{reservation.time}</p>
                            <p className="text-gray-600">{reservation.guests} guests</p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button
                            onClick={handleCancellation}
                            disabled={loading}
                            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Cancelling...' : 'Confirm'}
                        </button>
                        <Link
                            href="/"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-center hover:bg-gray-50 transition-colors"
                        >
                            Go Back
                        </Link>
                    </div>
                </div>
            </motion.div>
            <Footer />
        </>
    );
} 