'use client';

import React, { useState, useEffect } from 'react';
import { db } from "@/firebase"
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

interface Reservation {
    id: string;
    date: Timestamp;
    time: string;
    name: string;
    guests: number;
    phone: string;
    email: string;
    comments: string;
    status: string;
    cancelledAt?: Timestamp | string;
}

// Add new helper functions
const generateTimeSlots = () => {
    const slots = [];
    // Generate slots from 11 AM to 10 PM in 30-minute intervals
    for (let hour = 11; hour <= 22; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
            const time = new Date();
            time.setHours(hour, minute, 0);
            slots.push(time.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            }));
        }
    }
    return slots;
};

// Add this helper function at the top of the file
const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Add this helper function at the top of the file
const formatDateTime = (timestamp: Timestamp | string | undefined) => {
    if (!timestamp) return '';

    if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleString('en-US');
    }

    return timestamp.toDate().toLocaleString('en-US');
};

export default function ReservationAdminPage() {
    const [viewMode, setViewMode] = useState<'past' | 'today' | 'future' | 'chart'>('today');
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const timeSlots = generateTimeSlots();

    useEffect(() => {
        const fetchReservations = async () => {
            setLoading(true);
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                const reservationsRef = collection(db, 'reservations');
                const q = query(reservationsRef);
                const querySnapshot = await getDocs(q);

                const fetchedReservations = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    const reservationDate = new Date(data.date);
                    return {
                        id: doc.id,
                        ...data,
                        date: Timestamp.fromDate(reservationDate)
                    } as Reservation;
                });

                let filteredReservations: Reservation[] = [];

                switch (viewMode) {
                    case 'past':
                        filteredReservations = fetchedReservations.filter(res =>
                            res.date.toDate() < today
                        ).sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
                        break;

                    case 'today':
                        filteredReservations = fetchedReservations.filter(res => {
                            const resDate = res.date.toDate();
                            return resDate.getDate() === today.getDate() &&
                                resDate.getMonth() === today.getMonth() &&
                                resDate.getFullYear() === today.getFullYear();
                        }).sort((a, b) => {
                            const timeA = convertTimeToMinutes(a.time);
                            const timeB = convertTimeToMinutes(b.time);
                            return timeA - timeB;
                        });
                        break;

                    case 'future':
                        filteredReservations = fetchedReservations.filter(res =>
                            res.date.toDate() >= tomorrow
                        ).sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
                        break;
                }

                setReservations(filteredReservations);

            } catch (error) {
                console.error('Error fetching reservations:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReservations();
    }, [viewMode]);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    const convertTimeToMinutes = (time: string): number => {
        const [rawTime, period] = time.split(' ');
        let [hours, minutes] = rawTime.split(':').map(Number);

        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }

        return hours * 60 + minutes;
    };

    const isReservationPassed = (reservationTime: string) => {
        const now = new Date();
        const [time, period] = reservationTime.split(' ');
        const [hours, minutes] = time.split(':').map(Number);

        let reservationHours = hours;
        if (period === 'PM' && hours !== 12) {
            reservationHours += 12;
        } else if (period === 'AM' && hours === 12) {
            reservationHours = 0;
        }

        return (now.getHours() > reservationHours) ||
            (now.getHours() === reservationHours && now.getMinutes() > minutes);
    };

    // Filter reservations based on search term
    const filteredReservations = viewMode === 'past' && searchTerm
        ? reservations.filter(reservation =>
            reservation.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : reservations;

    // Modify the getStatusBadge function
    const getStatusBadge = (status: string, isPassed: boolean) => {
        if (isPassed) return 'bg-gray-100 text-gray-600';
        if (status === 'cancelled') return 'bg-red-100 text-red-800';
        return ''; // Return empty string for other statuses
    };

    // Update the handleSendReminder function
    const handleSendReminder = async (reservation: Reservation) => {
        try {
            const response = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reservationId: reservation.id,
                    email: reservation.email,
                    name: reservation.name,
                    date: reservation.date.toDate().toISOString(), // Convert Timestamp to ISO string
                    time: reservation.time,
                    guests: reservation.guests
                }),
            });

            if (!response.ok) throw new Error('Failed to send reminder');
            alert('Reminder sent successfully!');
        } catch (error) {
            console.error('Error sending reminder:', error);
            alert('Failed to send reminder');
        }
    };

    return (
        <AdminLayout>
            <div className="p-4 sm:p-6 bg-gray-100 min-h-screen">
                <Link
                    href="/admin/home"
                    className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
                >
                    <svg
                        className="w-6 h-6 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                    </svg>
                    Back to Dashboard
                </Link>
                <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">
                    Reservation Overview
                </h1>

                {/* View Mode Selector */}
                <div className="mb-6">
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                        <button
                            className={`px-4 sm:px-6 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'past' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('past')}
                        >
                            Past
                        </button>
                        <button
                            className={`px-4 sm:px-6 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'today' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('today')}
                        >
                            Today
                        </button>
                        <button
                            className={`px-4 sm:px-6 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'future' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('future')}
                        >
                            Future
                        </button>
                    </div>
                </div>

                {/* Search Input - Only show for past reservations */}
                {viewMode === 'past' && (
                    <div className="mb-6">
                        <div className="max-w-md mx-auto">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search by customer name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 pl-10 pr-4 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg
                                        className="h-5 w-5 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                        />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Clock for Today's View */}
                {viewMode === 'today' && (
                    <div className="mb-6 text-center">
                        <div className="inline-flex items-center bg-white px-4 py-2 rounded-lg shadow-sm">
                            <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-lg font-semibold text-gray-700" suppressHydrationWarning>
                                {currentTime.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </span>
                        </div>
                    </div>
                )}

                {viewMode === 'today' ? (
                    // Compact Card View for Today's Reservations
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {timeSlots.map((timeSlot) => {
                            const slotReservations = filteredReservations.filter(
                                res => res.time === timeSlot
                            );

                            if (slotReservations.length === 0) return null;

                            return slotReservations.map((reservation) => {
                                const isCancelled = reservation.status === 'cancelled';
                                const isPassed = isReservationPassed(reservation.time);

                                return (
                                    <div
                                        key={reservation.id}
                                        className={`bg-white rounded-lg shadow-md overflow-hidden transition-all
                                            ${isPassed ? 'opacity-60' : ''}
                                            ${isCancelled ? 'border border-red-200' : ''}
                                        `}
                                    >
                                        <div className="p-4">
                                            {/* Time Badge */}
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                    ${isPassed ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-800'}
                                                `}>
                                                    {reservation.time}
                                                </span>
                                                {(isPassed || isCancelled) && (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                        ${isPassed ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-800'}
                                                    `}>
                                                        {isPassed ? 'Prior' : 'Cancelled'}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Guest Info */}
                                            <div className={`${isCancelled ? 'line-through' : ''}`}>
                                                <h3 className="text-base font-semibold text-gray-900">
                                                    {reservation.name}
                                                </h3>

                                                {/* Guest Count */}
                                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                                    <span className="font-medium">{reservation.guests} guests</span>
                                                </div>

                                                {/* Contact Info */}
                                                <div className="mt-2 space-y-1 text-sm text-gray-600">
                                                    <p className="truncate">{reservation.phone}</p>
                                                    <p className="truncate">{reservation.email}</p>
                                                </div>

                                                {/* Notes (if any) */}
                                                {reservation.comments && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <p className="text-sm text-gray-600 line-clamp-2">
                                                            <span className="font-medium">Notes:</span>{' '}
                                                            {reservation.comments}
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Cancellation Timestamp */}
                                                {isCancelled && reservation.cancelledAt && (
                                                    <div className="mt-2 pt-2 border-t border-gray-100">
                                                        <p className="text-xs text-gray-500" suppressHydrationWarning>
                                                            Cancelled: {formatDateTime(reservation.cancelledAt)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Add this button to your reservation card */}
                                            <button
                                                onClick={() => handleSendReminder(reservation)}
                                                className="mt-2 w-full px-3 py-1 text-sm text-blue-600 hover:text-blue-800 
                                                           border border-blue-600 hover:border-blue-800 rounded-lg 
                                                           transition-colors flex items-center justify-center gap-2"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                </svg>
                                                Send Reminder
                                            </button>
                                        </div>
                                    </div>
                                );
                            });
                        }).filter(Boolean)}
                    </div>
                ) : (
                    // Card View for Past and Future
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredReservations.map((reservation) => {
                            const isCancelled = reservation.status === 'cancelled';
                            const isPassed = viewMode === 'past';

                            return (
                                <div
                                    key={reservation.id}
                                    className={`bg-white rounded-lg shadow-md overflow-hidden transition-all ${isPassed ? 'opacity-60' : ''
                                        }`}
                                >
                                    <div className="p-4">
                                        <div className={`${isCancelled ? 'line-through' : ''}`}>
                                            <div className="flex items-center gap-2 flex-wrap mb-2">
                                                <h3 className="text-base font-semibold text-gray-900">
                                                    {reservation.name}
                                                </h3>
                                                {(isPassed || reservation.status === 'cancelled') && (
                                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(reservation.status, isPassed)
                                                        }`}>
                                                        {isPassed ? 'Prior' : reservation.status === 'cancelled' ? 'Cancelled' : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Compact info row */}
                                            <div className="flex items-center gap-3 text-sm text-gray-600 mb-2">
                                                <span>{formatDate(reservation.date.toDate())}</span>
                                                <span>•</span>
                                                <span>{reservation.time}</span>
                                                <span>•</span>
                                                <span>{reservation.guests} guests</span>
                                            </div>

                                            {/* Contact info */}
                                            <div className="text-sm text-gray-600">
                                                <p>{reservation.phone}</p>
                                                <p className="truncate">{reservation.email}</p>
                                            </div>

                                            {/* Notes (if any) */}
                                            {reservation.comments && (
                                                <div className="mt-2 pt-2 border-t border-gray-100">
                                                    <p className="text-sm text-gray-600 line-clamp-2">
                                                        <span className="font-medium">Notes:</span>{' '}
                                                        {reservation.comments}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Cancellation info */}
                                            {isCancelled && reservation.cancelledAt && (
                                                <div className="mt-2 pt-2 border-t border-gray-100">
                                                    <p className="text-xs text-gray-500" suppressHydrationWarning>
                                                        Cancelled: {formatDateTime(reservation.cancelledAt)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* No Results Message */}
                {!loading && filteredReservations.length === 0 && (
                    <div className="text-center py-8 bg-white rounded-lg shadow-md">
                        <p className="text-gray-600 text-base">
                            {searchTerm
                                ? `No reservations found for "${searchTerm}"`
                                : 'No reservations found for this period.'
                            }
                        </p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}