'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase';

interface DashboardMetrics {
    totalReservations: number;
    uniqueCustomers: number;
    todayReservations: number;

}

export default function AdminHome() {
    const [pageViews, setPageViews] = useState<{ id: string, views: string }[]>([]);


    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalReservations: 0,
        uniqueCustomers: 0,
        todayReservations: 0,

    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const analyticsRef = collection(db, 'analytics');
                const q = query(analyticsRef, orderBy('date', 'desc'), limit(50));
                const snapshot = await getDocs(q);

                const views = snapshot.docs.map(doc => ({
                    id: doc.id,
                    views: doc.data().views || '0'
                }));

                setPageViews(views);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchAnalytics();
    }, []);


    useEffect(() => {
        async function fetchMetrics() {
            try {
                const reservationsRef = collection(db, 'reservations');
                const snapshot = await getDocs(reservationsRef);

                // Get unique customers by email and phone
                const uniqueEmails = new Set();
                const uniquePhones = new Set();
                let todayCount = 0;
                const today = new Date().toDateString();

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.email) uniqueEmails.add(data.email);
                    if (data.phone) uniquePhones.add(data.phone);

                    // Count today's reservations
                    if (new Date(data.date).toDateString() === today) {
                        todayCount++;
                    }
                });

                setMetrics({
                    totalReservations: snapshot.size,
                    uniqueCustomers: uniqueEmails.size + uniquePhones.size,
                    todayReservations: todayCount,

                });
            } catch (error) {
                console.error('Error fetching metrics:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchMetrics();
    }, []);
    console.log(pageViews)

    return (
        <AdminLayout>
            <h1 className="text-2xl font-bold mb-6">Dashboard Overview</h1>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Total Page Views Card */}
                    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Page Views</p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {pageViews[0]?.views ? Number(pageViews[0].views) / 2 : 0}
                                </p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-full">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    {/* Total Reservations Card */}
                    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Total Reservations</p>
                                <p className="text-3xl font-bold text-gray-900">{metrics.totalReservations}</p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-full">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Unique Customers Card */}
                    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Unique Customers</p>
                                <p className="text-3xl font-bold text-gray-900">{metrics.uniqueCustomers}</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-full">
                                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Today's Reservations Card */}
                    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Today's Reservations</p>
                                <p className="text-3xl font-bold text-gray-900">{metrics.todayReservations}</p>
                            </div>
                            <div className="p-3 bg-purple-50 rounded-full">
                                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}