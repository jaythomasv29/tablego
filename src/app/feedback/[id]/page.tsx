'use client';

import { useState, useEffect, use } from 'react';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Banner from '@/components/Banner';

interface Reservation {
    id: string;
    name: string;
    email: string;
    phone?: string;
    date: string;
    time: string;
    guests: number;
    attendanceStatus?: 'show' | 'no-show' | 'default';
    feedbackSentiment?: 'good' | 'bad' | null;
    privateFeedback?: string;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function FeedbackPage({ params }: PageProps) {
    const { id } = use(params);
    const [reservation, setReservation] = useState<Reservation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        const fetchReservation = async () => {
            try {
                const reservationDoc = await getDoc(doc(db, 'reservations', id));
                if (!reservationDoc.exists()) {
                    setError('Reservation not found');
                } else {
                    const data = reservationDoc.data();
                    setReservation({ id: reservationDoc.id, ...data } as Reservation);
                    if (data.privateFeedback) setSubmitted(true);
                }
            } catch {
                setError('Failed to load reservation');
            } finally {
                setLoading(false);
            }
        };

        fetchReservation();
    }, [id]);

    const handleSubmit = async () => {
        if (!reservation || !comment.trim()) return;
        setSubmitting(true);
        try {
            await updateDoc(doc(db, 'reservations', id), {
                privateFeedback: comment.trim(),
                privateFeedbackAt: Timestamp.now(),
            });

            await fetch('/api/send-feedback-notification', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: reservation.name,
                    email: reservation.email,
                    phone: reservation.phone,
                    date: reservation.date,
                    time: reservation.time,
                    guests: reservation.guests,
                    feedback: comment.trim(),
                }),
            });

            setSubmitted(true);
        } catch {
            setError('Failed to submit feedback');
        } finally {
            setSubmitting(false);
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

    if (error || !reservation) {
        return (
            <>
                <Navbar />
                <Banner />
                <div className="min-h-screen flex items-center justify-center px-4">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-gray-900 mb-4">{error || 'Reservation not found'}</h1>
                        <Link href="/" className="text-indigo-600 hover:text-indigo-800">
                            Return to Homepage
                        </Link>
                    </div>
                </div>
                <Footer />
            </>
        );
    }

    const isNoShow = reservation.attendanceStatus === 'no-show';
    const isNegative = reservation.feedbackSentiment === 'bad';

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
                    {isNoShow ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Thanks for letting us know</h2>
                            <p className="text-gray-600 mb-6">
                                We hope to see you at Thaiphoon Restaurant another time soon!
                            </p>
                        </>
                    ) : isNegative && !submitted ? (
                        <>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">We&apos;re sorry to hear that</h2>
                            <p className="text-gray-600 mb-6">
                                We&apos;d love to know what we could have done better. Your feedback goes directly to our team.
                            </p>
                            <textarea
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={4}
                                placeholder="Tell us what happened..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-4 text-gray-900 placeholder-gray-400"
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={submitting || !comment.trim()}
                                className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting ? 'Sending...' : 'Send Feedback'}
                            </button>
                        </>
                    ) : (
                        <>
                            <svg className="w-16 h-16 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Thanks for your feedback</h2>
                            <p className="text-gray-600 mb-6">
                                We&apos;ve passed this along to our team. We hope to see you again soon!
                            </p>
                        </>
                    )}

                    <Link href="/" className="inline-block mt-2 text-indigo-600 hover:text-indigo-800">
                        Return to Homepage
                    </Link>
                </div>
            </motion.div>
            <Footer />
        </>
    );
}
