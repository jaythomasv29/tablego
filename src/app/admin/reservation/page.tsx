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
    console.log(reservations);

    useEffect(() => {
        const fetchReservations = async () => {
            setLoading(true);
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                console.log('Reference Today:', today);

                const reservationsRef = collection(db, 'reservations');
                const q = query(reservationsRef);
                const querySnapshot = await getDocs(q);

                console.log('Total reservations found:', querySnapshot.size);

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
                        );
                        break;
                    case 'today':
                        filteredReservations = fetchedReservations.filter(res => {
                            const resDate = res.date.toDate();
                            return resDate.getDate() === today.getDate() &&
                                resDate.getMonth() === today.getMonth() &&
                                resDate.getFullYear() === today.getFullYear();
                        });
                        break;
                    case 'future':
                        filteredReservations = fetchedReservations.filter(res =>
                            res.date.toDate() > today
                        );
                        break;
                }

                // Sort the results
                filteredReservations.sort((a, b) => {
                    const dateA = a.date.toDate().getTime();
                    const dateB = b.date.toDate().getTime();
                    return viewMode === 'past' ? dateB - dateA : dateA - dateB;
                });

                console.log(`${viewMode} reservations found:`, filteredReservations.length);
                setReservations(filteredReservations);

            } catch (error) {
                console.error('Error fetching reservations:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchReservations();
    }, [viewMode]);

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
                <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-gray-800">Reservation Overview</h1>

                {/* View Mode Selector */}
                <div className="mb-6">
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-4">
                        <button
                            className={`px-4 sm:px-6 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base ${viewMode === 'past' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                                }`}
                            onClick={() => setViewMode('past')}
                        >
                            Past
                        </button>
                        <button
                            className={`px-4 sm:px-6 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base ${viewMode === 'today' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                                }`}
                            onClick={() => setViewMode('today')}
                        >
                            Today
                        </button>
                        <button
                            className={`px-4 sm:px-6 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base ${viewMode === 'future' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                                }`}
                            onClick={() => setViewMode('future')}
                        >
                            Future
                        </button>
                    </div>
                </div>

                {/* Reservations Table/Cards */}
                <div className="w-full">
                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            {/* Mobile View (Cards) */}
                            <div className="block sm:hidden">
                                {reservations.map((reservation) => (
                                    <div key={reservation.id} className="bg-white rounded-lg shadow-md p-4 mb-4">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center border-b pb-2">
                                                <div className="font-semibold">{reservation.name}</div>
                                                <div className="text-sm text-gray-600">
                                                    {reservation.guests} guests
                                                </div>
                                            </div>
                                            <div className="text-sm">
                                                <p className="text-gray-600">
                                                    {reservation.date?.toDate?.() ?
                                                        `${reservation.date.toDate().toLocaleDateString()} ${reservation.time}`
                                                        : 'Invalid Date'
                                                    }
                                                </p>
                                                <p className="text-gray-600">{reservation.phone}</p>
                                                <p className="text-gray-600">{reservation.email}</p>
                                                {reservation.comments && (
                                                    <p className="text-gray-600 mt-2">
                                                        <span className="font-medium">Notes:</span> {reservation.comments}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View (Table) */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="min-w-full bg-white rounded-lg shadow-md">
                                    <thead className="bg-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Date & Time</th>
                                            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Customer Name</th>
                                            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Party Size</th>
                                            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Phone</th>
                                            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Email</th>
                                            <th className="px-6 py-3 text-left text-gray-600 font-semibold">Special Requests</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reservations.map((reservation) => (
                                            <tr key={reservation.id} className="border-b hover:bg-gray-100 transition-colors duration-200">
                                                <td className="px-6 py-4">
                                                    {reservation.date?.toDate?.() ?
                                                        `${reservation.date.toDate().toLocaleDateString()} ${reservation.time}`
                                                        : 'Invalid Date'
                                                    }
                                                </td>
                                                <td className="px-6 py-4">{reservation.name}</td>
                                                <td className="px-6 py-4">{reservation.guests}</td>
                                                <td className="px-6 py-4">{reservation.phone}</td>
                                                <td className="px-6 py-4">{reservation.email}</td>
                                                <td className="px-6 py-4">{reservation.comments}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}