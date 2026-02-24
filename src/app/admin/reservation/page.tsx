'use client';

import React, { useState, useEffect } from 'react';
import { db } from "@/firebase"
import { collection, query, where, getDocs, Timestamp, orderBy, doc, updateDoc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Calendar as CalendarIcon, Check, ChevronsUpDown, Users, Calendar, Clock, Mail, Edit, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { Toaster } from 'react-hot-toast';

import ReminderModal from '@/components/ReminderModal';
import { formatReadableDatePST } from '@/utils/dateUtils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTimezone, TIMEZONE_OPTIONS } from '@/contexts/TimezoneContext';

export interface Reservation {
    id: string;
    date: Timestamp | any;
    time: string;
    name: string;
    guests: number;
    phone: string;
    email: string;
    comments: string;
    status: string;
    createdAt?: any;
    cancelledAt?: Timestamp | string;
    selected?: boolean;
    reminderSent?: boolean;
    reminderSentAt?: Timestamp;
    attendanceStatus?: 'show' | 'no-show' | 'default';
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
const formatDate = (date: Timestamp | string | Date, timezone: string = 'America/Los_Angeles') => {
    // If it's already a YYYY-MM-DD string, parse it directly without timezone conversion
    // Since this represents a calendar date (not a moment in time), we display it as-is
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const [year, month, day] = date.split('-').map(Number);
        // Create a date object and format it - using UTC to avoid any timezone shifts
        const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'UTC' // Use UTC since we constructed the date in UTC
        });
    }

    // If it's a Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
        return date.toDate().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: timezone
        });
    }

    // If it's a string (ISO format)
    if (typeof date === 'string') {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: timezone
        });
    }

    // If it's already a Date object
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: timezone
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

// Add this helper function
const getReminderStatus = (reservation: Reservation) => {
    if (reservation.reminderSent) {
        return {
            text: 'Reminder Sent',
            className: 'bg-green-100 text-green-800'
        };
    }
    return null;
};

// Add this helper function
const canSendReminder = (reservation: Reservation) => {
    // Business rule: reminder can only be sent once.
    return !reservation.reminderSent;
};

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

// Add this helper function at the top
const isSameLocalDate = (date1: Timestamp | string, date2: Date) => {
    // Convert Timestamp or string to Date object
    const d1 = typeof date1 === 'string' ? new Date(date1) : date1.toDate();

    // Compare only the date parts in local timezone
    return d1.getFullYear() === date2.getFullYear() &&
        d1.getMonth() === date2.getMonth() &&
        d1.getDate() === date2.getDate();
};

// Add this helper function to compare dates in UTC
const isSameDayUTC = (date1: Timestamp | string, date2: Date) => {
    // Convert first date to UTC Date object
    const d1 = typeof date1 === 'string'
        ? new Date(date1)
        : date1.toDate();

    // Compare only the date parts in UTC
    return d1.getUTCFullYear() === date2.getUTCFullYear() &&
        d1.getUTCMonth() === date2.getUTCMonth() &&
        d1.getUTCDate() === date2.getUTCDate();
};

// Add this helper function to check if a date is in the future (UTC)
const isDateInFutureUTC = (date: Timestamp | string) => {
    const today = new Date();
    const todayUTC = Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
    );

    const compareDate = typeof date === 'string' ? new Date(date) : date.toDate();
    const compareDateUTC = Date.UTC(
        compareDate.getUTCFullYear(),
        compareDate.getUTCMonth(),
        compareDate.getUTCDate()
    );

    return compareDateUTC > todayUTC;
};

// First, add or update the getStatusBadge function
const getStatusBadge = (status: string, isPassed: boolean) => {
    if (isPassed) return 'bg-gray-100 text-gray-600';
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

// Add this helper function to get status text
const getStatusText = (status: string, isPassed: boolean) => {
    if (isPassed) return 'Prior';
    switch (status?.toLowerCase()) {
        case 'confirmed':
            return 'Confirmed';
        case 'cancelled':
            return 'Cancelled';
        case 'pending':
            return 'Pending';
        default:
            return 'Pending';
    }
};

// Add this helper function at the top of the file
const getDateFromTimestamp = (date: Timestamp | string) => {
    if (typeof date === 'string') {
        return new Date(date);
    }
    return date.toDate();
};

// Update the helper function to handle both Timestamp and string
const getDatePart = (date: Timestamp | string) => {
    if (typeof date === 'string') {
        return date.split('T')[0];
    }
    return date.toDate().toISOString().split('T')[0];
};

// Define a simple BarChart component since we don't have the original
// const BarChart = ({ data, indexBy, keys, colors, padding, labelTextColor, labelSkipWidth, labelSkipHeight, axisLeft, axisBottom, margin, animate, motionStiffness, motionDamping }) => (
//     <ResponsiveBar
//         data={data}
//         indexBy={indexBy}
//         keys={keys}
//         colors={colors}
//         padding={padding}
//         labelTextColor={labelTextColor}
//         labelSkipWidth={labelSkipWidth}
//         labelSkipHeight={labelSkipHeight}
//         axisLeft={axisLeft}
//         axisBottom={axisBottom}
//         margin={margin}
//         animate={animate}
//     />
// );

// Add this helper function to get month name
const getMonthName = (date: Timestamp | string) => {
    const d = typeof date === 'string' ? new Date(date) : date.toDate();
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
};

// Add this helper function at the top of the file
const getLocalDateStringHelper = (date: Date | string | Timestamp, timeZone: string) => {
    // If it's already a YYYY-MM-DD string, return it directly
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    // If it's a full ISO string, extract the date part and convert to local timezone
    if (typeof date === 'string') {
        const d = new Date(date);
        return d.toLocaleDateString('en-CA', { timeZone });
    }

    // If it's a Date object
    if (date instanceof Date) {
        return date.toLocaleDateString('en-CA', { timeZone });
    }

    // If it's a Firestore Timestamp
    if (date && typeof date === 'object' && 'toDate' in date) {
        return date.toDate().toLocaleDateString('en-CA', { timeZone });
    }

    // Fallback
    return new Date().toLocaleDateString('en-CA', { timeZone });
};

export default function ReservationAdminPage() {
    const { timezone, loading: timezoneLoading } = useTimezone();
    const [viewMode, setViewMode] = useState<'past' | 'yesterday' | 'today' | 'tomorrow' | 'future' | 'chart'>('today');
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>('');
    const timeSlots = generateTimeSlots();
    const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [modalSuccess, setModalSuccess] = useState(false);
    const [modalError, setModalError] = useState<string | null>(null);
    const [sentEmailCount, setSentEmailCount] = useState(0);
    const [totalEmailCount, setTotalEmailCount] = useState(0);
    
    // Get timezone label for display
    const getTimezoneLabel = (value: string) => {
        const option = TIMEZONE_OPTIONS.find(opt => opt.value === value);
        return option ? option.label : value;
    };

    // Add handleAttendanceUpdate function inside the component
    const handleAttendanceUpdate = async (reservationId: string, status: 'show' | 'no-show' | 'default') => {
        try {
            const reservationRef = doc(db, 'reservations', reservationId);
            await updateDoc(reservationRef, {
                attendanceStatus: status === 'default' ? null : status
            });

            // Update local state
            setReservations((prevReservations: Reservation[]) =>
                prevReservations.map((res: Reservation) =>
                    res.id === reservationId
                        ? { ...res, attendanceStatus: status === 'default' ? undefined : status }
                        : res
                )
            );

            toast.success('Attendance status updated');
        } catch (error) {
            console.error('Error updating attendance status:', error);
            toast.error('Failed to update attendance status');
        }
    };

    useEffect(() => {
        // Wait for timezone to be loaded
        if (timezoneLoading) return;
        
        const fetchReservations = async () => {
            setLoading(true);
            try {
                // Get today's date in restaurant's timezone and format as YYYY-MM-DD
                const now = new Date();
                const todayLocal = now.toLocaleDateString('en-CA', { timeZone: timezone });
                
                // Calculate yesterday and tomorrow by parsing today's date string
                // This ensures we're working in the restaurant's timezone correctly
                const [year, month, day] = todayLocal.split('-').map(Number);
                
                const yesterdayDate = new Date(year, month - 1, day - 1);
                const yesterdayLocal = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;
                
                const tomorrowDate = new Date(year, month - 1, day + 1);
                const tomorrowLocal = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`;
                
                const reservationsRef = collection(db, 'reservations');
                const q = query(reservationsRef);
                const querySnapshot = await getDocs(q);

                const fetchedReservations = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                    } as Reservation;
                });

                let filteredReservations: Reservation[] = [];

                switch (viewMode) {
                    case 'today':
                        filteredReservations = fetchedReservations.filter(res => {
                            const reservationDateLocal = getLocalDateStringHelper(res.date, timezone);
                            return reservationDateLocal === todayLocal;
                        }).sort((a, b) => {
                            const timeA = convertTimeToMinutes(a.time);
                            const timeB = convertTimeToMinutes(b.time);
                            return timeA - timeB;
                        });
                        break;

                    case 'yesterday':
                        filteredReservations = fetchedReservations.filter(res => {
                            const reservationDateLocal = getLocalDateStringHelper(res.date, timezone);
                            return reservationDateLocal === yesterdayLocal;
                        }).sort((a, b) => {
                            const timeA = convertTimeToMinutes(a.time);
                            const timeB = convertTimeToMinutes(b.time);
                            return timeA - timeB;
                        });
                        break;

                    case 'tomorrow':
                        filteredReservations = fetchedReservations.filter(res => {
                            const reservationDateLocal = getLocalDateStringHelper(res.date, timezone);
                            return reservationDateLocal === tomorrowLocal;
                        }).sort((a, b) => {
                            const timeA = convertTimeToMinutes(a.time);
                            const timeB = convertTimeToMinutes(b.time);
                            return timeA - timeB;
                        });
                        break;

                    case 'past':
                        // Past = all dates before yesterday
                        filteredReservations = fetchedReservations.filter(res => {
                            const reservationDateLocal = getLocalDateStringHelper(res.date, timezone);
                            return reservationDateLocal < yesterdayLocal;
                        }).sort((a, b) => getLocalDateStringHelper(b.date, timezone).localeCompare(getLocalDateStringHelper(a.date, timezone)));
                        break;

                    case 'future':
                        // Future = all dates after tomorrow
                        filteredReservations = fetchedReservations.filter(res => {
                            const reservationDateLocal = getLocalDateStringHelper(res.date, timezone);
                            return reservationDateLocal > tomorrowLocal;
                        }).sort((a, b) => getLocalDateStringHelper(a.date, timezone).localeCompare(getLocalDateStringHelper(b.date, timezone)));
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
    }, [viewMode, timezone, timezoneLoading]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now);
            
            // Format time for display in restaurant's timezone
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
            setCurrentTimeDisplay(`${dateString} at ${timeString}`);
        };
        
        updateTime();
        const timer = setInterval(updateTime, 1000);

        return () => clearInterval(timer);
    }, [timezone]);

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
        // Get current time in restaurant's timezone
        const now = new Date();
        const restaurantNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
        
        const [time, period] = reservationTime.split(' ');
        const [hours, minutes] = time.split(':').map(Number);

        let reservationHours = hours;
        if (period === 'PM' && hours !== 12) {
            reservationHours += 12;
        } else if (period === 'AM' && hours === 12) {
            reservationHours = 0;
        }

        return (restaurantNow.getHours() > reservationHours) ||
            (restaurantNow.getHours() === reservationHours && restaurantNow.getMinutes() > minutes);
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

    // Add this function to update a single reservation
    const updateReservationReminderStatus = (reservationId: string) => {
        setReservations(prevReservations =>
            prevReservations.map(res => {
                if (res.id === reservationId) {
                    return {
                        ...res,
                        reminderSent: true,
                        reminderSentAt: Timestamp.now()
                    };
                }
                return res;
            })
        );
    };

    // Update handleSendReminder
    const handleSendReminder = async (reservation: Reservation) => {
        if (!canSendReminder(reservation)) {
            toast.error('Reminder was already sent for this reservation');
            return;
        }

        try {
            toast.loading('Sending reminder...', { id: reservation.id });
            const response = await fetch('/api/send-reminder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reservationId: reservation.id,
                    email: reservation.email,
                    name: reservation.name,
                    date: reservation.date,
                    time: reservation.time,
                    guests: reservation.guests
                }),
            });

            if (!response.ok) throw new Error('Failed to send reminder');

            // Update UI optimistically
            setReservations(prev =>
                prev.map(r =>
                r.id === reservation.id
                    ? { ...r, reminderSent: true, reminderSentAt: Timestamp.now() }
                    : r
                )
            );

            toast.success('Reminder sent successfully', { id: reservation.id });
        } catch (error) {
            console.error('Error sending reminder:', error);
            toast.error('Failed to send reminder', { id: reservation.id });
        }
    };

    const toggleSelectionMode = () => {
        setIsSelectionMode(!isSelectionMode);
        setSelectedReservations(new Set());
    };

    const toggleReservationSelection = (reservationId: string) => {
        const newSelection = new Set(selectedReservations);
        if (newSelection.has(reservationId)) {
            newSelection.delete(reservationId);
        } else {
            newSelection.add(reservationId);
        }
        setSelectedReservations(newSelection);
    };

    // Update handleBatchReminder
    const handleBatchReminder = async () => {
        const selectedReservationsList = filteredReservations.filter(res =>
            selectedReservations.has(res.id) && canSendReminder(res)
        );

        if (selectedReservationsList.length === 0) {
            setModalError('No eligible reservations to send reminders to');
            setModalOpen(true);
            return;
        }

        setModalOpen(true);
        setModalLoading(true);
        setModalSuccess(false);
        setModalError(null);
        setTotalEmailCount(selectedReservationsList.length);
        setSentEmailCount(0);

        try {
            for (let i = 0; i < selectedReservationsList.length; i++) {
                const reservation = selectedReservationsList[i];
                const dateToSend = typeof reservation.date === 'string'
                    ? reservation.date
                    : reservation.date.toDate().toISOString();

                const response = await fetch('/api/send-reminder', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reservationId: reservation.id,
                        email: reservation.email,
                        name: reservation.name,
                        date: dateToSend,
                        time: reservation.time,
                        guests: reservation.guests
                    }),
                });

                if (response.ok) {
                    // Update UI for each successful reminder
                    updateReservationReminderStatus(reservation.id);
                    setSentEmailCount(i + 1);
                }
            }

            setModalSuccess(true);
            setIsSelectionMode(false);
            setSelectedReservations(new Set());
        } catch (error) {
            setModalError('Failed to send some reminders');
            console.error('Error sending batch reminders:', error);
        } finally {
            setModalLoading(false);
        }
    };

    // Replace handleConfirmReservation with handleClose
    const handleClose = (reservationId: string) => {
        // Just remove the reservation from the list in UI
        const updatedReservations = reservations.filter(r => r.id !== reservationId);
        setReservations(updatedReservations);
    };

    const handleSendSMS = async (reservation: Reservation) => {
        try {
            const response = await fetch('/api/send-sms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    reservationId: reservation.id,
                    phone: reservation.phone,
                    name: reservation.name,
                    date: reservation.date,
                    time: reservation.time,
                    guests: reservation.guests,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to send SMS');
            }

            toast.success('SMS sent successfully');
        } catch (error) {
            console.error('Error sending SMS:', error);
            toast.error('Failed to send SMS');
        }
    };

    const getReservationBorderClass = (reservation: Reservation) => {
        if (reservation.status?.toLowerCase() === 'cancelled') return 'border-red-500';
        if (reservation.attendanceStatus === 'show') return 'border-green-500';
        if (reservation.attendanceStatus === 'no-show') return 'border-orange-500';
        if (viewMode === 'today' && isReservationPassed(reservation.time)) return 'border-gray-400';
        return 'border-blue-400';
    };

    const getReminderLabel = (reservation: Reservation) => {
        if (!reservation.reminderSent) return 'Not sent';
        if (!reservation.reminderSentAt) return 'Sent';
        return `Sent ${formatTimeAgo(reservation.reminderSentAt.toDate())}`;
    };

    const renderReservationCard = (reservation: Reservation) => {
        const isCancelled = reservation.status?.toLowerCase() === 'cancelled';
        const canSend = canSendReminder(reservation);
        const isSelected = selectedReservations.has(reservation.id);
        const [displayTime, displayPeriod] = reservation.time?.split(' ') ?? [reservation.time, ''];
        const isTodayCompact = viewMode === 'today';

        return (
            <div
                key={reservation.id}
                className={`bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 border-l-4 ${getReservationBorderClass(reservation)}`}
            >
                <div className="p-0">
                    <div className="flex items-stretch">
                        <div className={`${isTodayCompact ? 'w-20 sm:w-24 px-1.5' : 'w-28 sm:w-32 px-2'} border-r bg-gray-50 flex items-center justify-center`}>
                            <div className="text-center leading-none">
                                <div className={`${isTodayCompact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-4xl'} font-black tracking-tight text-gray-900`}>
                                    {displayTime}
                                </div>
                                {displayPeriod && (
                                    <div className="text-[11px] sm:text-xs font-semibold text-gray-500 mt-1 tracking-wide">
                                        {displayPeriod}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`flex-1 ${isTodayCompact ? 'p-3' : 'p-4'}`}>
                            <div className={`flex items-start justify-between ${isTodayCompact ? 'gap-2 mb-1.5' : 'gap-3 mb-2'}`}>
                                <div className="min-w-0">
                                    <h3 className={`font-semibold text-gray-900 truncate ${isTodayCompact ? 'text-sm' : ''}`}>{reservation.name}</h3>
                                    <div className={`flex flex-wrap items-center gap-2 ${isTodayCompact ? 'mt-0.5 text-xs' : 'mt-1 text-sm'} text-gray-600`}>
                                        <span className="flex items-center">
                                            <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                            {formatReadableDatePST(reservation.date, timezone)}
                                        </span>
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5">
                                            <Users className="w-3.5 h-3.5 text-blue-500" />
                                            <span className="text-base leading-none font-bold text-blue-700">{reservation.guests}</span>
                                            <span className="text-[11px] font-medium text-blue-600">{reservation.guests === 1 ? 'guest' : 'guests'}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    {isSelectionMode && (
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleReservationSelection(reservation.id)}
                                            disabled={!canSend}
                                            title={canSend ? 'Select for reminder' : 'Reminder already sent'}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                    )}
                                    <Badge variant={isCancelled ? 'destructive' : reservation.status === 'Confirmed' ? 'success' : 'warning'}>
                                        {reservation.status}
                                    </Badge>
                                    {reservation.attendanceStatus && (
                                        <Badge variant={reservation.attendanceStatus === 'show' ? 'success' : 'destructive'}>
                                            {reservation.attendanceStatus === 'show' ? 'Showed' : 'No-Show'}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className={`flex flex-wrap ${isTodayCompact ? 'gap-x-4 text-xs mb-2' : 'gap-x-5 text-sm mb-3'} gap-y-1 text-gray-600`}>
                                <span className="flex items-center">
                                    <svg className="w-3.5 h-3.5 mr-1 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                    </svg>
                                    {reservation.phone}
                                </span>
                                <span className="flex items-center">
                                    <Mail className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                    <span className={`truncate ${isTodayCompact ? 'max-w-[220px]' : 'max-w-[320px]'}`}>{reservation.email}</span>
                                </span>
                            </div>

                            <div className={`flex flex-wrap ${isTodayCompact ? 'gap-x-4 text-[11px] mb-2' : 'gap-x-5 text-xs mb-3'} gap-y-1 text-gray-500`}>
                                <span className="flex items-center">
                                    <CalendarIcon className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                    Reservation made: {reservation.createdAt ? formatDateTime(reservation.createdAt) : 'N/A'}
                                </span>
                                <span className={`flex items-center ${reservation.reminderSent ? 'text-green-600' : 'text-amber-600'}`}>
                                    <Mail className="w-3.5 h-3.5 mr-1" />
                                    Reminder: {getReminderLabel(reservation)}
                                </span>
                            </div>

                            {reservation.comments && (
                                <div className={`${isTodayCompact ? 'text-xs p-2 mb-2' : 'text-sm p-2.5 mb-3'} text-gray-700 bg-yellow-50 border border-yellow-200 rounded-md`}>
                                    <span className="font-medium text-xs text-yellow-800 mr-1">Notes:</span>
                                    {reservation.comments}
                                </div>
                            )}

                            <div className={`flex flex-wrap items-center justify-between ${isTodayCompact ? 'gap-1.5 pt-2' : 'gap-2 pt-3'} border-t`}>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn(
                                            `bg-white border-gray-200 ${isTodayCompact ? 'h-7 px-2 text-xs' : ''}`,
                                            reservation.attendanceStatus === 'show'
                                                ? "text-green-800 bg-green-50 border-green-200"
                                                : "hover:bg-green-50 hover:text-green-800"
                                        )}
                                        onClick={() => handleAttendanceUpdate(reservation.id, 'show')}
                                    >
                                        Show
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className={cn(
                                            `bg-white border-gray-200 ${isTodayCompact ? 'h-7 px-2 text-xs' : ''}`,
                                            reservation.attendanceStatus === 'no-show'
                                                ? "text-red-800 bg-red-50 border-red-200"
                                                : "hover:bg-red-50 hover:text-red-800"
                                        )}
                                        onClick={() => handleAttendanceUpdate(reservation.id, 'no-show')}
                                    >
                                        No-show
                                    </Button>
                                </div>
                                <Button
                                    size="sm"
                                    onClick={() => handleSendReminder(reservation)}
                                    disabled={!canSend}
                                    variant="outline"
                                    className={`bg-white hover:bg-gray-50 ${isTodayCompact ? 'h-7 px-2 text-xs' : ''}`}
                                    title={canSend ? 'Send reservation reminder email' : 'Reminder already sent'}
                                >
                                    <Mail className="w-4 h-4 mr-1" />
                                    {canSend ? 'Send Reminder' : 'Reminder Sent'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderReservationsContent = () => {
        if (viewMode === 'today') {
            return (
                <div className="space-y-1.5">
                    {filteredReservations.map(renderReservationCard)}
                </div>
            );
        }

        if (viewMode === 'future') {
            const reservationsByMonth: { [key: string]: Reservation[] } = {};
            filteredReservations.forEach((reservation) => {
                const monthYear = getMonthName(reservation.date);
                if (!reservationsByMonth[monthYear]) reservationsByMonth[monthYear] = [];
                reservationsByMonth[monthYear].push(reservation);
            });

            const sortedMonths = Object.keys(reservationsByMonth).sort((a, b) => {
                const dateA = new Date(a);
                const dateB = new Date(b);
                return dateA.getTime() - dateB.getTime();
            });

            return (
                <div className="space-y-5">
                    {sortedMonths.map((monthYear) => {
                        const monthReservations = reservationsByMonth[monthYear];
                        return (
                            <div key={monthYear} className="space-y-2">
                                <div className="bg-blue-50 px-4 py-2 rounded-md font-medium text-blue-700 flex items-center border-l-4 border-blue-500">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    <span className="text-lg">{monthYear}</span>
                                    <span className="ml-2 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                                        {monthReservations.length} {monthReservations.length === 1 ? 'reservation' : 'reservations'}
                                    </span>
                                </div>
                                {monthReservations.map(renderReservationCard)}
                            </div>
                        );
                    })}
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {filteredReservations.map(renderReservationCard)}
            </div>
        );
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
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-center text-gray-800">
                    Reservation Overview
                </h1>

                {/* Current Time in Restaurant's Timezone */}
                <div className="mb-6 flex justify-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm">
                            <span className="text-gray-500">Current time in </span>
                            <span className="font-medium text-gray-700">{getTimezoneLabel(timezone)}</span>
                            <span className="text-gray-500">: </span>
                            <span className="font-medium text-gray-900">{currentTimeDisplay}</span>
                        </div>
                    </div>
                </div>

                {/* View Mode Selector */}
                <div className="mb-6">
                    <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                        <button
                            className={`px-3 sm:px-5 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'past' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('past')}
                        >
                            Past
                        </button>
                        <button
                            className={`px-3 sm:px-5 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'yesterday' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('yesterday')}
                        >
                            Yesterday
                        </button>
                        <button
                            className={`px-3 sm:px-5 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'today' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('today')}
                        >
                            Today
                        </button>
                        <button
                            className={`px-3 sm:px-5 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
                                ${viewMode === 'tomorrow' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800'}`}
                            onClick={() => setViewMode('tomorrow')}
                        >
                            Tomorrow
                        </button>
                        <button
                            className={`px-3 sm:px-5 py-2 rounded-lg shadow-md transition-colors duration-300 text-sm sm:text-base 
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


                {/* Add these buttons after the view mode selector */}
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <button
                            onClick={toggleSelectionMode}
                            className={`px-4 py-2 rounded-lg transition-colors ${isSelectionMode
                                ? 'bg-gray-600 text-white'
                                : 'bg-white text-gray-600 border border-gray-300'
                                }`}
                        >
                            {isSelectionMode ? 'Cancel Selection' : 'Select Multiple'}
                        </button>

                        {isSelectionMode && selectedReservations.size > 0 && (
                            <button
                                onClick={handleBatchReminder}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                                         transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Send Reminders ({selectedReservations.size})
                            </button>
                        )}
                    </div>
                </div>

                {renderReservationsContent()}

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

                <ReminderModal
                    isOpen={modalOpen}
                    isLoading={modalLoading}
                    success={modalSuccess}
                    error={modalError}
                    onClose={() => setModalOpen(false)}
                    totalEmails={totalEmailCount}
                    sentEmails={sentEmailCount}
                />

                <Toaster position="bottom-right" />
            </div>
        </AdminLayout>
    );
}
