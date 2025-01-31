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
}

export default function ReservationAdminPage() {
    const [viewMode, setViewMode] = useState<'past' | 'today' | 'future'>('today');
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());

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

                let filteredReservations = [];

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
                        filteredReservations = fetchedReservations.filter(res => {
                            const resDate = res.date.toDate();
                            return resDate >= tomorrow;
                        }).sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
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
                            <span className="text-lg font-semibold text-gray-700">
                                {currentTime.toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: true
                                })}
                            </span>
                        </div>
                    </div>
                )}

                {/* Reservations Grid */}
                <div className="w-full">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredReservations.map((reservation) => {
                                const isPassed = viewMode === 'today' && isReservationPassed(reservation.time);

                                return (
                                    <div
                                        key={reservation.id}
                                        className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200 ${isPassed ? 'opacity-50' : ''
                                            }`}
                                    >
                                        {/* Add passed indicator for today's reservations */}
                                        {viewMode === 'today' && (
                                            <div className={`mb-2 text-sm font-medium ${isPassed ? 'text-red-500' : 'text-green-500'
                                                }`}>
                                                {isPassed ? 'Passed' : 'Upcoming'}
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {/* Header with Name and Guest Count */}
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <div className="font-semibold text-lg text-gray-800">
                                                    {reservation.name}
                                                </div>
                                                <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                                                    {reservation.guests} {reservation.guests === 1 ? 'guest' : 'guests'}
                                                </div>
                                            </div>

                                            {/* Date and Time */}
                                            <div className="flex items-center text-gray-600">
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                    />
                                                </svg>
                                                <span>
                                                    {reservation.date?.toDate?.() ?
                                                        `${reservation.date.toDate().toLocaleDateString()} at ${reservation.time}`
                                                        : 'Invalid Date'
                                                    }
                                                </span>
                                            </div>

                                            {/* Contact Information */}
                                            <div className="space-y-1">
                                                <div className="flex items-center text-gray-600">
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                        />
                                                    </svg>
                                                    <span>{reservation.phone}</span>
                                                </div>
                                                <div className="flex items-center text-gray-600">
                                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                    <span className="text-blue-600 hover:text-blue-800">
                                                        {reservation.email}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Special Requests */}
                                            {reservation.comments && (
                                                <div className="border-t pt-2">
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">Notes:</span>{' '}
                                                        {reservation.comments}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* No Results Message */}
                    {!loading && filteredReservations.length === 0 && (
                        <div className="text-center py-12 bg-white rounded-lg shadow-md">
                            <p className="text-gray-600 text-lg">
                                {searchTerm
                                    ? `No reservations found for "${searchTerm}"`
                                    : 'No reservations found for this period.'
                                }
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}