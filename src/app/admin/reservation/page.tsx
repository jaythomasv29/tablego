'use client';

import React, { useState, useEffect } from 'react';
import { db } from "@/firebase"
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import Link from 'next/link';

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
        <div className="p-6 bg-gray-100 min-h-screen">
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
            <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">Reservation Overview</h1>

            {/* View Mode Selector */}
            <div className="mb-6 flex justify-center">
                <div className="flex gap-4">
                    <button
                        className={`px-6 py-2 rounded-lg shadow-md transition-colors duration-300 ${viewMode === 'past' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                            }`}
                        onClick={() => setViewMode('past')}
                    >
                        Past Reservations
                    </button>
                    <button
                        className={`px-6 py-2 rounded-lg shadow-md transition-colors duration-300 ${viewMode === 'today' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                            }`}
                        onClick={() => setViewMode('today')}
                    >
                        Today's Reservations
                    </button>
                    <button
                        className={`px-6 py-2 rounded-lg shadow-md transition-colors duration-300 ${viewMode === 'future' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'
                            }`}
                        onClick={() => setViewMode('future')}
                    >
                        Future Reservations
                    </button>
                </div>
            </div>

            {/* Reservations Table */}
            <div className="overflow-x-auto">
                {loading ? (
                    <div className="text-center py-4 text-gray-600">Loading reservations...</div>
                ) : (
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
                )}
            </div>
        </div>
    );
}