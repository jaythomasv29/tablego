'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/firebase';
// import { getTotalPageViews } from '@/utils/analytics';
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
import { X } from 'lucide-react';

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
    const [pendingReservations, setPendingReservations] = useState<PendingReservation[]>([]);
    const [isConfirming, setIsConfirming] = useState<string>('');
    const [showMobileNotification, setShowMobileNotification] = useState(true);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'messages'>('dashboard');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isMarkingRead, setIsMarkingRead] = useState<string>('');

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                const response = await fetch('/api/analytics');
                const data = await response.json();
                console.log('Vercel Analytics Data:', data);

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

    const fetchPendingReservations = async () => {
        try {
            const q = query(
                collection(db, 'reservations'),
                where('status', '==', 'pending'),
                orderBy('date', 'asc')
            );
            console.log('Fetching pending reservations...');
            const snapshot = await getDocs(q);
            console.log('Total documents found:', snapshot.size);

            const pendingRes = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('Reservation data:', data);

                // Handle different date formats
                let dateObj;
                if (data.date?.toDate) {
                    // If it's a Firestore Timestamp
                    dateObj = data.date.toDate();
                } else if (data.date) {
                    // If it's a string or another format
                    dateObj = new Date(data.date);
                } else {
                    // Fallback to current date if no date is provided
                    dateObj = new Date();
                }

                return {
                    id: doc.id,
                    ...data,
                    date: dateObj
                };
            }) as PendingReservation[];

            console.log('Processed pending reservations:', pendingRes);
            setPendingReservations(pendingRes);
        } catch (error) {
            console.error('Error fetching pending reservations:', error);
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

    const handleConfirmReservation = async (reservationId: string) => {
        setIsConfirming(reservationId);
        try {
            const reservationRef = doc(db, 'reservations', reservationId);
            await updateDoc(reservationRef, {
                status: 'confirmed'
            });
            // Refresh both pending reservations and metrics
            await Promise.all([
                fetchPendingReservations(),
                fetchMetrics()
            ]);
            // Add success toast notification
            toast.success('Reservation confirmed successfully!');
        } catch (error) {
            console.error('Error confirming reservation:', error);
            // Add error toast notification
            toast.error('Failed to confirm reservation');
        } finally {
            setIsConfirming('');
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

    return (
        <AdminLayout>
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
                {/* <div className="flex space-x-2">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 rounded-lg ${activeTab === 'dashboard'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Dashboard
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`px-4 py-2 rounded-lg flex items-center ${activeTab === 'messages'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        Messages
                        {messages.filter(m => m.status === 'unread').length > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                                {messages.filter(m => m.status === 'unread').length}
                            </span>
                        )}
                    </button>
                </div> */}
            </div>

            {activeTab === 'dashboard' ? (
                <>
                    {/* Metrics Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
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

                    {/* Pending Reservations Card - Full Width */}
                    <div id="pending-reservations" className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow mb-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm font-medium text-gray-600">Pending Reservations</p>
                                <p className="text-3xl font-bold text-gray-900">{pendingReservations.length}</p>
                            </div>
                            <div className="p-3 bg-yellow-50 rounded-full">
                                <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-96 overflow-y-auto">
                            {pendingReservations.map((reservation) => (
                                <div
                                    key={reservation.id}
                                    className="border-b pb-4 last:border-0 last:pb-0"
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
                                            onClick={() => handleConfirmReservation(reservation.id)}
                                            disabled={isConfirming === reservation.id}
                                            className={`px-3 py-1 rounded-full text-sm font-medium 
                                                ${isConfirming === reservation.id
                                                    ? 'bg-gray-100 text-gray-400'
                                                    : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                                        >
                                            {isConfirming === reservation.id ? 'Confirming...' : 'Confirm'}
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {pendingReservations.length === 0 && (
                                <p className="text-center text-gray-500 py-4">
                                    No pending reservations
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Analytics Chart */}
                    <div className="bg-white rounded-xl shadow-md p-6">
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
        </AdminLayout>
    );
}