'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase';
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
import toast, { Toaster } from 'react-hot-toast';
import { ArrowRightCircle, X } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import StaggeredList from '@/components/StaggeredList';
import { Timestamp } from 'firebase/firestore';
import { Calendar, Users, Clock } from 'lucide-react';
import { formatReadableDatePST } from '@/utils/dateUtils';
import { Reservation } from '../reservation/page';
import Link from 'next/link';
import { useTimezone } from '@/contexts/TimezoneContext';

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

// interface Reservation {
//     id: string;
//     date: Date;
//     time: string;
//     name: string;
//     guests: number;
//     phone: string;
//     email: string;
//     status: string;
//     comments?: string;
//     createdAt?: string;
//     reminderSent?: boolean;
//     reminderSentAt?: Timestamp;
//     marked?: boolean;
// }

interface PendingReservation {
    id: string;
    name: string;
    date: Date;
    time: string;
    guests: number;
    phone: string;
    email: string;
    status: string;
}

interface MobileNotificationProps {
    count: number;
    onClose: () => void;
}

interface Message {
    id: string;
    name: string;
    email: string;
    message: string;
    timestamp: Date;
    status: 'read' | 'unread';
}

function MobileNotification({ count, onClose }: MobileNotificationProps) {
    if (count === 0) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:hidden">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-lg">
                <div className="flex items-start">
                    <div className="flex-shrink-0">
                        <svg
                            className="h-5 w-5 text-yellow-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <div className="ml-3 flex-1">
                        <p className="text-sm text-yellow-700">
                            You have {count} pending {count === 1 ? 'reservation' : 'reservations'} that {count === 1 ? 'needs' : 'need'} confirmation
                        </p>
                        <div className="mt-2">
                            <button
                                onClick={() => {
                                    const element = document.getElementById('pending-reservations');
                                    element?.scrollIntoView({ behavior: 'smooth' });
                                    onClose();
                                }}
                                className="text-sm font-medium text-yellow-700 hover:text-yellow-600"
                            >
                                View Reservations →
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 ml-4"
                    >
                        <X className="h-4 w-4 text-yellow-500" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// Add this helper function after the imports
const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
        const minutes = Math.floor(diffInHours * 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    }
    if (diffInHours < 24) {
        const hours = Math.floor(diffInHours);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(diffInHours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
};

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

// Add this helper function
const isReservationPassed = (reservationTime: string): boolean => {
    const [time, period] = reservationTime.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();

    let compareHours = hours;
    if (period === 'PM' && hours !== 12) compareHours += 12;
    if (period === 'AM' && hours === 12) compareHours = 0;

    const reservationDate = new Date();
    reservationDate.setHours(compareHours, minutes);

    return now > reservationDate;
};

export default function AdminHome() {
    const { timezone } = useTimezone();
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
    const [pendingReservations, setPendingReservations] = useState<Reservation[]>([]);
    const [isConfirming, setIsConfirming] = useState<string>('');
    const [showMobileNotification, setShowMobileNotification] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'messages'>('dashboard');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isMarkingRead, setIsMarkingRead] = useState<string>('');
    const [todayReservations, setTodayReservations] = useState<Reservation[]>([]);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const response = await fetch('/api/analytics');
                const data = await response.json();


                setTotalViews(data.pageViews?.value || 0);
                setDailyViews(data.dailyViews || []);
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
            // Get today's date in restaurant's timezone and format as YYYY-MM-DD
            const todayLocal = new Date().toLocaleDateString('en-CA', {
                timeZone: timezone
            });

            const reservationsRef = collection(db, 'reservations');
            const snapshot = await getDocs(reservationsRef);

            const uniqueEmails = new Set();
            const uniquePhones = new Set();
            let todayCount = 0;
            const todaysList: Reservation[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();

                // Handle different date formats consistently
                let reservationDate: string;
                if (typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
                    // Already in YYYY-MM-DD format
                    reservationDate = data.date;
                } else if (data.date instanceof Timestamp) {
                    // Firestore Timestamp
                    reservationDate = data.date.toDate().toLocaleDateString('en-CA', {
                        timeZone: timezone
                    });
                } else {
                    // ISO string or other format
                    reservationDate = new Date(data.date).toLocaleDateString('en-CA', {
                        timeZone: timezone
                    });
                }

                // Compare just the date parts
                if (reservationDate === todayLocal) {
                    todayCount++;
                    todaysList.push({
                        id: doc.id,
                        date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date + 'T12:00:00'),
                        time: data.time,
                        name: data.name,
                        guests: data.guests,
                        phone: data.phone,
                        email: data.email,
                        status: data.status || 'pending',
                        comments: data.comments || '',
                        createdAt: data.createdAt,
                        reminderSent: data.reminderSent,
                        reminderSentAt: data.reminderSentAt
                    });
                }

                if (data.email) uniqueEmails.add(data.email);
                if (data.phone) uniquePhones.add(data.phone);
            });

            // Sort today's reservations by time
            todaysList.sort((a, b) => {
                const timeA = convertTimeToMinutes(a.time);
                const timeB = convertTimeToMinutes(b.time);
                return timeA - timeB;
            });

            setTodaysReservations(todaysList);
            setMetrics({
                totalReservations: snapshot.size,
                uniqueCustomers: uniqueEmails.size + uniquePhones.size,
                todayReservations: todayCount,
                totalCatering: metrics.totalCatering,
                newCatering: metrics.newCatering,
            });

        } catch (error) {
            console.error('Error fetching metrics:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingReservations = async () => {
        try {
            const reservationsRef = collection(db, 'reservations');
            const q = query(
                reservationsRef,
                where('marked', '==', false),
                orderBy('date', 'desc')
            );
            const snapshot = await getDocs(q);
            const reservations = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    // Convert Firestore Timestamp to JavaScript Date
                    date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date)
                };
            }) as Reservation[];
            setPendingReservations(reservations);
        } catch (error) {
            console.error('Error fetching reservations:', error);
        }
    };

    const fetchMessages = async () => {
        try {
            const messagesRef = collection(db, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const messagesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            })) as Message[];
            setMessages(messagesList);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    useEffect(() => {
        async function fetchData() {
            try {
                setLoading(true);
                await Promise.all([
                    fetchMetrics(),
                    fetchPendingReservations(),
                    fetchMessages()
                ]);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [timezone]);

    // console.log(totalViews)

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

    const handleMarkReservation = async (reservationId: string) => {
        try {
            const reservationRef = doc(db, 'reservations', reservationId);
            await updateDoc(reservationRef, {
                marked: true,
                markedAt: new Date()
            });

            setPendingReservations(prev =>
                prev.filter(reservation => reservation.id !== reservationId)
            );

            toast.success('Reservation marked');
        } catch (error) {
            console.error('Error marking reservation:', error);
            toast.error('Failed to mark reservation');
        }
    };

    useEffect(() => {
        if (pendingReservations.length > 0) {
            setShowMobileNotification(true);
        }
    }, [pendingReservations]);

    const handleMarkAsRead = async (messageId: string) => {
        setIsMarkingRead(messageId);
        try {
            const messageRef = doc(db, 'messages', messageId);
            await updateDoc(messageRef, {
                status: 'read'
            });
            await fetchMessages();
            toast.success('Message marked as read');
        } catch (error) {
            console.error('Error marking message as read:', error);
            toast.error('Failed to mark message as read');
        } finally {
            setIsMarkingRead('');
        }
    };

    useEffect(() => {
        const fetchTodayReservations = async () => {
            try {
                // Get today's date range in local timezone
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const tomorrow = new Date(today);
                tomorrow.setDate(tomorrow.getDate() + 1);

                // Convert to UTC for Firestore query
                const todayUTC = new Date(today.toUTCString());
                const tomorrowUTC = new Date(tomorrow.toUTCString());

                const reservationsRef = collection(db, 'reservations');
                const q = query(
                    reservationsRef,
                    where('date', '>=', Timestamp.fromDate(todayUTC)),
                    where('date', '<', Timestamp.fromDate(tomorrowUTC))
                );

                const querySnapshot = await getDocs(q);
                const reservations = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Reservation[];

                // Sort by time
                reservations.sort((a, b) => {
                    const timeA = convertTo24Hour(a.time);
                    const timeB = convertTo24Hour(b.time);
                    return timeA.localeCompare(timeB);
                });

                setTodayReservations(reservations);
            } catch (error) {
                console.error('Error fetching today reservations:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTodayReservations();
    }, []);

    // Helper function to convert time to 24-hour format for sorting
    const convertTo24Hour = (time12h: string) => {
        const [time, modifier] = time12h.split(' ');
        let [hours, minutes] = time.split(':');

        if (hours === '12') {
            hours = '00';
        }

        if (modifier === 'PM') {
            hours = String(parseInt(hours, 10) + 12);
        }

        return `${hours}:${minutes}`;
    };

    // Helper function to get status badge styles
    const getStatusBadge = (status: string) => {
        switch (status?.toLowerCase()) {
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

    // Function to check if a reservation is for today (in local time)
    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    return (
        <AdminLayout>
            <PageTransition>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#363636',
                            color: '#fff',
                            zIndex: 9999,
                        },
                        className: 'sm:max-w-[90vw] md:max-w-md',
                    }}
                    containerStyle={{
                        top: 40,
                        left: 20,
                        right: 20,
                    }}
                />
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Dashboard Overview</h1>


                </div>

                {activeTab === 'dashboard' ? (
                    <>
                        {/* Metrics Cards Grid */}
                        <StaggeredList>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                                {/* Total Page Views Card */}
                                {/* <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
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
                                </div> */}
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
                        </StaggeredList>

                        {/* Today's Reservations Card - Full Width */}
                        <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Today's Reservations</p>
                                    <p className="text-3xl flex items-center gap-2 font-bold text-gray-900">{metrics.todayReservations}  <Link href="/admin/reservation" className="inline-flex w-fit items-center gap-2 text-sm bg-blue-500 text-white px-2 py-1 rounded-md transition-colors">View All <ArrowRightCircle className="w-4 h-4" /></Link></p>
                                </div>
                                <div className="p-3 bg-purple-50 rounded-full">
                                    <Calendar className="w-6 h-6 text-purple-500" />
                                </div>
                            </div>

                        </div>

                        {/* New Reservations Card - Full Width */}
                        <div id="pending-reservations" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">New Reservations</p>
                                    <p className="text-3xl font-bold text-gray-900">{pendingReservations.length}</p>
                                </div>
                                <div className="p-3 bg-yellow-50 rounded-full">
                                    <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                            </div>

                            <StaggeredList>
                                <div className="space-y-4 max-h-96 overflow-y-auto">
                                    {pendingReservations.map((reservation) => (
                                        <div
                                            key={reservation.id}
                                            className={`bg-white rounded-lg shadow p-3 flex flex-col min-h-[300px] relative ${isReservationPassed(reservation.time) ? 'opacity-60' : ''
                                                }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-medium text-gray-900">{reservation.name}</p>
                                                    <p className="text-sm text-gray-600">
                                                        {reservation.date.toLocaleDateString()} at {reservation.time}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        {reservation.guests} guests
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        {reservation.phone}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleMarkReservation(reservation.id)}
                                                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    {pendingReservations.length === 0 && (
                                        <p className="text-center text-gray-500 py-4">
                                            No new reservations
                                        </p>
                                    )}
                                </div>
                            </StaggeredList>
                        </div>

                        {/* Analytics Chart */}
                        {/* <div className="bg-white rounded-xl shadow-md p-6">
                            <div className="h-[400px]">
                                {loading ? (
                                    <div className="flex justify-center items-center h-full">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                    </div>
                                ) : (
                                    <Line options={options} data={chartData} />
                                )}
                            </div>
                        </div> */}
                    </>
                ) : (
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <div className="space-y-4">
                            {messages.map((message) => (
                                <div
                                    key={message.id}
                                    className={`border-b pb-4 last:border-0 last:pb-0 ${message.status === 'unread' ? 'bg-blue-50 p-4 rounded-lg' : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-medium text-gray-900">{message.name}</p>
                                            <p className="text-sm text-gray-600">{message.email}</p>
                                            <p className="text-sm text-gray-500 mt-1">
                                                {message.timestamp.toLocaleDateString()} at{' '}
                                                {message.timestamp.toLocaleTimeString()}
                                            </p>
                                            <p className="mt-2 text-gray-700">{message.message}</p>
                                        </div>
                                        {message.status === 'unread' && (
                                            <button
                                                onClick={() => handleMarkAsRead(message.id)}
                                                disabled={isMarkingRead === message.id}
                                                className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                                            >
                                                {isMarkingRead === message.id ? 'Marking...' : 'Mark as Read'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            {messages.length === 0 && (
                                <p className="text-center text-gray-500 py-4">
                                    No messages yet
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Add Mobile Notification */}
                <MobileNotification
                    count={pendingReservations.length}
                    onClose={() => setShowMobileNotification(false)}
                />
            </PageTransition>
        </AdminLayout>
    );
}