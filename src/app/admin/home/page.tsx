'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { getTotalPageViews, getDailyPageViews } from '@/utils/analytics';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface DashboardMetrics {
    totalReservations: number;
    uniqueCustomers: number;
    todayReservations: number;
    totalCatering: number;
    newCatering: number;
}

interface Reservation {
    name: string;
    time: string;
    guests: number;
    date: string;
}

export default function AdminHome() {
    const [totalViews, setTotalViews] = useState<number>(0);
    const [dailyViews, setDailyViews] = useState<{ date: string; views: number }[]>([]);

    const [metrics, setMetrics] = useState<DashboardMetrics>({
        totalReservations: 0,
        uniqueCustomers: 0,
        todayReservations: 0,
        totalCatering: 0,
        newCatering: 0,

    });
    const [loading, setLoading] = useState(true);
    const [todaysReservations, setTodaysReservations] = useState<Reservation[]>([]);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const [views, daily] = await Promise.all([
                    getTotalPageViews(),
                    getDailyPageViews(7) // Get last 7 days
                ]);
                setTotalViews(views);
                setDailyViews(daily);
            } catch (error) {
                console.error('Error fetching analytics:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchAnalytics();
    }, []);


    const fetchMetrics = async () => {
        try {
            const reservationsRef = collection(db, 'reservations');
            const snapshot = await getDocs(reservationsRef);
            const today = new Date().toDateString();
            const uniqueEmails = new Set(snapshot.docs.map(doc => doc.data().email));
            const uniquePhones = new Set(snapshot.docs.map(doc => doc.data().phone));
            let todayCount = 0;
            // Store today's reservations
            const todaysList: Reservation[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (new Date(data.date).toDateString() === today) {
                    todaysList.push({
                        name: data.name,
                        time: data.time,
                        guests: data.guests,
                        date: data.date
                    });
                }
                // Get unique customers by email and phone


                // const today = new Date().toDateString();

                if (data.email) uniqueEmails.add(data.email);
                if (data.phone) uniquePhones.add(data.phone);

                // Count today's reservations
                if (new Date(data.date).toDateString() === today) {
                    todayCount++;
                }
            });

            setTodaysReservations(todaysList);

            // Add catering fetch
            const cateringRef = collection(db, 'catering');
            const cateringSnapshot = await getDocs(cateringRef);

            // Count new (uncompleted) catering requests
            const newCateringCount = cateringSnapshot.docs.filter(
                doc => doc.data().status === 'pending'
            ).length;

            setMetrics({
                totalReservations: snapshot.size,
                uniqueCustomers: uniqueEmails.size + uniquePhones.size,
                todayReservations: todayCount,
                totalCatering: cateringSnapshot.size,
                newCatering: newCateringCount,

            });
        } catch (error) {
            console.error('Error fetching metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetrics();
    }, []);

    console.log(totalViews)

    // Add new state for loading
    const [markingAsRead, setMarkingAsRead] = useState(false);

    const markAllCateringRead = async () => {
        setMarkingAsRead(true);
        try {
            const cateringRef = collection(db, 'catering');
            const unreadQuery = query(cateringRef, where('status', '==', 'pending'));
            const snapshot = await getDocs(unreadQuery);

            const updatePromises = snapshot.docs.map(doc =>
                updateDoc(doc.ref, { status: 'completed' })
            );

            await Promise.all(updatePromises);
            await fetchMetrics();
        } catch (error) {
            console.error('Error marking catering as read:', error);
        } finally {
            setMarkingAsRead(false);
        }
    };

    // Chart options
    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Daily Page Views',
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0
                }
            }
        }
    };

    // Chart data
    const chartData = {
        labels: dailyViews.map(item => new Date(item.date).toLocaleDateString()),
        datasets: [
            {
                label: 'Page Views',
                data: dailyViews.map(item => item.views),
                borderColor: 'rgb(59, 130, 246)', // Blue
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                tension: 0.3
            }
        ]
    };

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
                                    {totalViews}
                                </p>
                            </div>
                            <div className="p-3 bg-blue-50 rounded-full">
                                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
                    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow relative group">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Today's Reservations</p>
                                <p className="text-3xl font-bold text-gray-900">{metrics.todayReservations}</p>

                                {/* Tooltip */}
                                {todaysReservations.length > 0 && (
                                    <div className="absolute left-0 top-full mt-2 w-64 bg-white shadow-lg rounded-lg p-4 hidden group-hover:block z-10">
                                        <div className="max-h-48 overflow-y-auto">
                                            {todaysReservations.map((res, index) => (
                                                <div key={index} className="mb-2 pb-2 border-b border-gray-100 last:border-0">
                                                    <p className="font-medium">{res.name}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {res.time} • {res.guests} guests
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-3 bg-purple-50 rounded-full">
                                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Total Catering Deals Card */}
                    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">
                                    New Catering Requests
                                    <span className="text-xs text-gray-400 ml-2">
                                        (Total: {metrics.totalCatering})
                                    </span>
                                </p>
                                <p className="text-3xl font-bold text-gray-900">
                                    {markingAsRead ? (
                                        <span className="inline-block animate-spin">⌛</span>
                                    ) : metrics.newCatering}
                                </p>
                                <button
                                    onClick={markAllCateringRead}
                                    className="mt-2 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded-md transition-colors"
                                >
                                    Mark All Read
                                </button>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded-full">
                                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Chart */}
            <div className="bg-white rounded-xl shadow-md p-6 mt-6">
                <div className="h-[400px]">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : (
                        <Line options={options} data={chartData} />
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}