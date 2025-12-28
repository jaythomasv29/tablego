'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, getDoc, query, orderBy, limit, where, updateDoc, doc } from 'firebase/firestore';
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
import {
    ArrowRightCircle,
    X,
    Calendar,
    Users,
    Clock,
    CalendarDays,
    TrendingUp,
    Utensils,
    Bell,
    CheckCircle2,
    XCircle,
    Phone,
    Mail,
    User,
    ChefHat
} from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import StaggeredList from '@/components/StaggeredList';
import { Timestamp } from 'firebase/firestore';
import { formatReadableDatePST } from '@/utils/dateUtils';
import { Reservation } from '../reservation/page';
import Link from 'next/link';
import { useTimezone, TIMEZONE_OPTIONS } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Business Hours interface
interface DayHours {
    lunch: {
        open: string;
        close: string;
        isOpen: boolean;
    };
    dinner: {
        open: string;
        close: string;
        isOpen: boolean;
    };
}

interface BusinessHours {
    [key: string]: DayHours;
}

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
    const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
    const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
    const [currentDateDisplay, setCurrentDateDisplay] = useState<string>('');

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

    // Fetch business hours
    useEffect(() => {
        const fetchBusinessHours = async () => {
            try {
                const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
                if (hoursDoc.exists()) {
                    setBusinessHours(hoursDoc.data() as BusinessHours);
                }
            } catch (error) {
                console.error('Error fetching business hours:', error);
            }
        };

        fetchBusinessHours();
    }, []);

    // Update current time display every second
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            });
            const dateString = now.toLocaleDateString('en-US', {
                timeZone: timezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            setCurrentTimeDisplay(timeString);
            setCurrentDateDisplay(dateString);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [timezone]);

    // Helper function to get timezone label
    const getTimezoneLabel = (value: string) => {
        const option = TIMEZONE_OPTIONS.find(opt => opt.value === value);
        return option ? option.label : value;
    };

    // Helper function to check if restaurant is currently open
    const getBusinessStatus = () => {
        if (!businessHours) return { isOpen: false, currentPeriod: null, closingTime: null, todayHours: null };

        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

        // Get the current day in the restaurant's timezone
        const restaurantNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
        const currentDay = days[restaurantNow.getDay()];
        const todayHours = businessHours[currentDay];

        if (!todayHours) return { isOpen: false, currentPeriod: null, closingTime: null, todayHours: null };

        const currentMinutes = restaurantNow.getHours() * 60 + restaurantNow.getMinutes();

        // Helper to convert time string to minutes
        const timeToMinutes = (timeStr: string): number => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            return hours * 60 + minutes;
        };

        // Helper to format time for display
        const formatTime = (timeStr: string): string => {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const period = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        // Check lunch hours
        if (todayHours.lunch?.isOpen) {
            const lunchOpen = timeToMinutes(todayHours.lunch.open);
            const lunchClose = timeToMinutes(todayHours.lunch.close);

            if (currentMinutes >= lunchOpen && currentMinutes < lunchClose) {
                return {
                    isOpen: true,
                    currentPeriod: 'Lunch',
                    closingTime: formatTime(todayHours.lunch.close),
                    todayHours
                };
            }
        }

        // Check dinner hours
        if (todayHours.dinner?.isOpen) {
            const dinnerOpen = timeToMinutes(todayHours.dinner.open);
            const dinnerClose = timeToMinutes(todayHours.dinner.close);

            if (currentMinutes >= dinnerOpen && currentMinutes < dinnerClose) {
                return {
                    isOpen: true,
                    currentPeriod: 'Dinner',
                    closingTime: formatTime(todayHours.dinner.close),
                    todayHours
                };
            }
        }

        return { isOpen: false, currentPeriod: null, closingTime: null, todayHours };
    };

    // Helper to format hours for display
    const formatHoursDisplay = (hours: DayHours | null): string[] => {
        if (!hours) return ['Closed'];

        const formatTime = (timeStr: string): string => {
            const [hoursNum, minutes] = timeStr.split(':').map(Number);
            const period = hoursNum >= 12 ? 'PM' : 'AM';
            const displayHours = hoursNum > 12 ? hoursNum - 12 : hoursNum === 0 ? 12 : hoursNum;
            return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
        };

        const parts: string[] = [];
        if (hours.lunch?.isOpen) {
            parts.push(`Lunch: ${formatTime(hours.lunch.open)} - ${formatTime(hours.lunch.close)}`);
        }
        if (hours.dinner?.isOpen) {
            parts.push(`Dinner: ${formatTime(hours.dinner.open)} - ${formatTime(hours.dinner.close)}`);
        }

        return parts.length > 0 ? parts : ['Closed'];
    };

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
            // Fetch recent reservations and filter for unmarked ones
            // This handles both marked: false AND missing marked field (legacy data)
            const q = query(
                reservationsRef,
                orderBy('createdAt', 'desc'),
                limit(50) // Check last 50 reservations
            );
            const snapshot = await getDocs(q);
            const reservations = snapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    // Include if marked is false OR if marked field doesn't exist
                    return data.marked === false || data.marked === undefined;
                })
                .map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        // Convert Firestore Timestamp to JavaScript Date
                        date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date + 'T12:00:00'),
                        // Convert createdAt Timestamp to ISO string for proper parsing
                        createdAt: data.createdAt instanceof Timestamp
                            ? data.createdAt.toDate().toISOString()
                            : data.createdAt
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

    const handleMarkReservation = async (reservationId: string, showToast = true) => {
        try {
            const reservationRef = doc(db, 'reservations', reservationId);
            await updateDoc(reservationRef, {
                marked: true,
                markedAt: new Date()
            });

            setPendingReservations(prev =>
                prev.filter(reservation => reservation.id !== reservationId)
            );

            if (showToast) {
                toast.success('Reservation acknowledged');
            }
        } catch (error) {
            console.error('Error marking reservation:', error);
            toast.error('Failed to acknowledge reservation');
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
                {/* Header */}
                <div className="mb-8">
                    <div className="p-7 relative bg-white">
                        <h1 className="text-3xl font-bold">
                            Thaiphoon Restaurant
                        </h1>
                        <p className="mt-1">
                            Welcome back! Here's what's happening today.
                        </p>
                        <div className="absolute top-4 right-6 opacity-15 pointer-events-none flex">
                            <Utensils className="w-20 h-20 text-gray-400" />
                        </div>
                    </div>
                </div>

                {activeTab === 'dashboard' ? (
                    <>
                        {/* Business Status Card - Clean Design */}
                        {(() => {
                            const status = getBusinessStatus();
                            return (
                                <Card className="mb-8 overflow-hidden border border-gray-200 bg-white">
                                    <CardContent className="p-6">
                                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                                            {/* Status */}
                                            <div className="flex items-center gap-4">
                                                <div className="p-4 rounded-2xl bg-gray-100">
                                                    {status.isOpen ? (
                                                        <CheckCircle2 className="w-8 h-8 text-gray-700" />
                                                    ) : (
                                                        <XCircle className="w-8 h-8 text-gray-500" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-2xl font-bold text-gray-900">
                                                            {status.isOpen ? 'We\'re Open!' : 'Currently Closed'}
                                                        </span>
                                                        {status.isOpen && status.currentPeriod && (
                                                            <Badge variant="outline" className="text-gray-600 border-gray-300">
                                                                {status.currentPeriod} Service
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    {status.isOpen && status.closingTime && (
                                                        <p className="text-gray-500 mt-1">
                                                            Open until {status.closingTime}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Time Display */}
                                            <div className="text-left lg:text-right">
                                                <div className="inline-flex flex-col bg-gray-50 border border-gray-200 rounded-2xl px-6 py-4">
                                                    <span className="text-gray-500 text-sm">{getTimezoneLabel(timezone)}</span>
                                                    <span className="text-3xl font-bold text-gray-900 font-mono">{currentTimeDisplay}</span>
                                                    <span className="text-gray-600 text-sm">{currentDateDisplay}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Today's Hours */}
                                        {status.todayHours && (
                                            <div className="mt-6 pt-6 border-t border-gray-200">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Clock className="w-4 h-4 text-gray-500" />
                                                    <span className="text-gray-500 text-sm font-medium">Today's Hours</span>
                                                </div>
                                                <div className="flex flex-wrap gap-3">
                                                    {formatHoursDisplay(status.todayHours).map((hourStr: string, idx: number) => (
                                                        <span key={idx} className="bg-gray-100 border border-gray-200 px-4 py-2 rounded-xl text-gray-700 text-sm font-medium">
                                                            {hourStr}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })()}

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            {/* Today's Reservations */}
                            <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200 bg-white overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gray-100 rounded-xl">
                                            <CalendarDays className="w-6 h-6 text-gray-600" />
                                        </div>
                                        <Link href="/admin/reservation">
                                            <Button size="sm" variant="ghost" className="text-gray-600 hover:bg-gray-100 gap-1">
                                                View <ArrowRightCircle className="w-4 h-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">Today's Reservations</p>
                                    <p className="text-4xl font-bold text-gray-900">{metrics.todayReservations}</p>
                                </CardContent>
                            </Card>

                            {/* Total Reservations */}
                            <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200 bg-white overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gray-100 rounded-xl">
                                            <TrendingUp className="w-6 h-6 text-gray-600" />
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">Total Reservations</p>
                                    <p className="text-4xl font-bold text-gray-900">{metrics.totalReservations}</p>
                                </CardContent>
                            </Card>

                            {/* Unique Customers */}
                            <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200 bg-white overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gray-100 rounded-xl">
                                            <Users className="w-6 h-6 text-gray-600" />
                                        </div>
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">Unique Customers</p>
                                    <p className="text-4xl font-bold text-gray-900">{metrics.uniqueCustomers}</p>
                                </CardContent>
                            </Card>

                            {/* Catering Requests */}
                            <Card className="group hover:shadow-lg transition-all duration-300 border border-gray-200 bg-white overflow-hidden">
                                <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gray-100 rounded-xl">
                                            <ChefHat className="w-6 h-6 text-gray-600" />
                                        </div>
                                        {metrics.newCatering > 0 && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-gray-600 hover:bg-gray-100"
                                                onClick={markAllCateringRead}
                                                disabled={markingAsRead}
                                            >
                                                {markingAsRead ? 'Marking...' : 'Clear'}
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-gray-500 text-sm font-medium mb-1">
                                        New Catering
                                        <span className="text-gray-400 ml-1">({metrics.totalCatering} total)</span>
                                    </p>
                                    <p className="text-4xl font-bold text-gray-900">
                                        {markingAsRead ? '...' : metrics.newCatering}
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* New Bookings Alert - Compact Rows */}
                        {pendingReservations.length > 0 && (
                            <Card id="pending-reservations" className="mb-8 border border-gray-200 shadow-sm">
                                <CardHeader className="py-3 px-4 border-b border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Bell className="w-4 h-4 text-gray-500" />
                                            <CardTitle className="text-sm font-medium text-gray-700">
                                                New Bookings
                                            </CardTitle>
                                            <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
                                                {pendingReservations.length} unread
                                            </Badge>
                                        </div>
                                        {pendingReservations.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={async () => {
                                                    const count = pendingReservations.length;
                                                    for (const res of pendingReservations) {
                                                        await handleMarkReservation(res.id, false);
                                                    }
                                                    toast.success(`${count} reservations acknowledged`);
                                                }}
                                                className="text-xs text-gray-500 hover:text-gray-700 h-7 px-2"
                                            >
                                                Acknowledge all
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
                                        {pendingReservations.map((reservation) => (
                                            <div
                                                key={reservation.id}
                                                className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 transition-colors group"
                                            >
                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                    <div className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
                                                    <span className="font-medium text-gray-900 text-sm truncate">
                                                        {reservation.name}
                                                    </span>
                                                    <span className="text-gray-400 text-sm hidden sm:inline">·</span>
                                                    <span className="text-gray-500 text-sm hidden sm:inline">
                                                        {reservation.guests} guests
                                                    </span>
                                                    <span className="text-gray-400 text-sm hidden md:inline">·</span>
                                                    <span className="text-gray-500 text-sm hidden md:inline">
                                                        {reservation.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {reservation.time}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    {reservation.createdAt && (
                                                        <span className="text-xs text-gray-400 hidden lg:inline">
                                                            {formatTimeAgo(new Date(reservation.createdAt))}
                                                        </span>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleMarkReservation(reservation.id)}
                                                        className="h-7 w-7 p-0 text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        title="Mark as seen"
                                                    >
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                ) : (
                    <Card className="border border-gray-200 shadow-sm">
                        <CardHeader className="border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-xl">
                                    <Mail className="w-5 h-5 text-gray-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-xl">Messages</CardTitle>
                                    <CardDescription>Customer inquiries and feedback</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={`group rounded-xl p-4 transition-all duration-200 ${message.status === 'unread'
                                            ? 'bg-gray-100 border border-gray-300'
                                            : 'bg-gray-50 border border-gray-200'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className={`p-3 rounded-xl ${message.status === 'unread' ? 'bg-white border border-gray-200' : 'bg-gray-200'}`}>
                                                    <User className="w-5 h-5 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">{message.name}</p>
                                                    <p className="text-sm text-gray-600 flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {message.email}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        {message.timestamp.toLocaleDateString()} at {message.timestamp.toLocaleTimeString()}
                                                    </p>
                                                    <p className="mt-3 text-gray-700 bg-white rounded-lg p-3 border border-gray-200">
                                                        {message.message}
                                                    </p>
                                                </div>
                                            </div>
                                            {message.status === 'unread' && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleMarkAsRead(message.id)}
                                                    disabled={isMarkingRead === message.id}
                                                    className="bg-white hover:bg-gray-50 text-gray-700 border-gray-300"
                                                >
                                                    {isMarkingRead === message.id ? 'Marking...' : 'Mark Read'}
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {messages.length === 0 && (
                                    <div className="text-center py-12">
                                        <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
                                            <Mail className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 font-medium">No messages yet</p>
                                        <p className="text-gray-400 text-sm">Customer messages will appear here</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
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