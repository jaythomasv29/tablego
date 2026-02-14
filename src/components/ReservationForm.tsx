'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Users, Mail, MessageSquare, Clock, User, Phone, Check } from 'lucide-react';
import Cookies from 'js-cookie';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import Navbar from './Navbar';
import { TimeSlot } from '@/types/TimeSlot';
import { toast } from 'react-hot-toast';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Banner from './Banner';
import { useTimezone, TIMEZONE_OPTIONS } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type ReservationData = {
  date: Date;
  time: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  comments: string;
};

// Initial data - date will be set properly in useEffect based on restaurant timezone
const initialData: ReservationData = {
  date: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 12, 0, 0, 0),
  time: '',
  guests: 2,
  name: '',
  email: '',
  phone: '',
  comments: '',
};

interface ReservationDetails {
  name: string;
  date: string;
  formattedDate?: string;
  time: string;
  guests: number;
  email: string;
  reservationId: string;
}

export interface BusinessHours {
  [key: string]: {
    lunch: {
      open: string;
      close: string;
      isOpen: boolean;
      customRanges?: { start: string; end: string }[];
    };
    dinner: {
      open: string;
      close: string;
      isOpen: boolean;
      customRanges?: { start: string; end: string }[];
    };
  };
}

const slotDuration = 30; // If it's a fixed value

interface SpecialDate {
  date: string;
  reason: string;
  closureType?: 'full' | 'lunch' | 'dinner';
}

const isSameMonthAndDay = (date1: Date, date2: Date): boolean => {
  return date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

const getClosureType = (specialDate?: SpecialDate): 'full' | 'lunch' | 'dinner' | null => {
  if (!specialDate) return null;
  // Backward compatibility: existing records without closureType are treated as full-day closures.
  return specialDate.closureType || 'full';
};

// Add theme for MUI components
const theme = createTheme({
  palette: {
    primary: {
      main: '#4F46E5', // Indigo-600 to match your theme
    },
  },
});

interface MenuItem {
  id: string;
  name: string;
  price?: number;
  description: string;
  category: string;
  imageUrl: string;
}

// Add this helper function at the top
// const formatDisplayDate = (dateString: string) => {
//   if (!dateString) return '';

//   try {
//     // If it's a Date object, convert to ISO string first
//     const date = dateString instanceof Date
//       ? dateString.toISOString().split('T')[0]
//       : dateString;

//     // Split the date string to get year, month, day
//     const [year, month, day] = date.split('-').map(Number);

//     // Create date object with explicit UTC time at noon to avoid timezone shifts
//     const formattedDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

//     return formattedDate.toLocaleDateString('en-US', {
//       weekday: 'long',
//       month: 'long',
//       day: 'numeric',
//       year: 'numeric',
//       timeZone: 'UTC'
//     });
//   } catch (error) {
//     console.error('Error formatting date:', error);
//     return dateString; // Return original string if formatting fails
//   }
// };

const formatDisplayDate2 = (dateString: string) => {
  if (!dateString) return '';

  // If it's a YYYY-MM-DD string, parse it directly to avoid timezone issues
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-').map(Number);
    // Create date in UTC at noon to avoid any date shifting
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  // For other formats, try to parse and display
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
};
export default function ReservationForm() {
  const { timezone, loading: timezoneLoading } = useTimezone();

  // Get timezone label for display
  const getTimezoneLabel = (value: string) => {
    const option = TIMEZONE_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : value;
  };
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reservationDetails, setReservationDetails] = useState<ReservationDetails | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // usePageTracking();
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [reservationCutoffMinutes, setReservationCutoffMinutes] = useState<number>(60); // Default 1 hour

  // Helper function to get current date in restaurant's timezone
  const getRestaurantDate = (date?: Date): Date => {
    const targetDate = date || new Date();
    return new Date(
      targetDate.toLocaleString("en-US", {
        timeZone: timezone,
      })
    );
  };

  // Helper to check if restaurant is open on a given day
  const isRestaurantOpenOnDay = (date: Date, hours: BusinessHours | null): boolean => {
    if (!hours) return true; // Assume open if we don't have hours yet

    // Use the local day from the Date object (what the user visually selected)
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[date.getDay()];
    const dayHours = hours[dayName];

    if (!dayHours) return false;

    // Restaurant is open if either lunch or dinner is open
    return dayHours.lunch?.isOpen || dayHours.dinner?.isOpen;
  };

  // Find the next open day starting from a given date
  const findNextOpenDay = (startDate: Date, hours: BusinessHours | null): Date => {
    const date = new Date(startDate);
    // Check up to 7 days ahead
    for (let i = 0; i < 7; i++) {
      if (isRestaurantOpenOnDay(date, hours)) {
        return date;
      }
      date.setDate(date.getDate() + 1);
    }
    return startDate; // Fallback to start date if all days are closed
  };

  // Initialize selectedDate once timezone and business hours are loaded
  useEffect(() => {
    if (!timezoneLoading && timezone && businessHours) {
      // Get today's date string in the restaurant's timezone (YYYY-MM-DD)
      const now = new Date();
      const restaurantDateStr = now.toLocaleDateString('en-CA', { timeZone: timezone });

      // Parse the date string to get year, month, day in restaurant's timezone
      const [year, month, day] = restaurantDateStr.split('-').map(Number);

      // Create a date object representing that calendar date at noon
      const restaurantToday = new Date(year, month - 1, day, 12, 0, 0, 0);

      // Check if today is open, if not find the next open day
      const nextOpenDay = findNextOpenDay(restaurantToday, businessHours);

      setSelectedDate(nextOpenDay);
      setFormData(prev => ({ ...prev, date: nextOpenDay }));
    }
  }, [timezoneLoading, timezone, businessHours]);

  // Simplified 2-step flow
  const steps = [
    { title: 'Reservation Details', icon: Calendar },
    { title: 'Confirmation', icon: Mail },
  ];

  const updateFormData = (data: Partial<ReservationData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    if (data.date) {
      setSelectedDate(data.date);
    }
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const handleStepClick = (stepIndex: number) => {
    // Only allow going back to previous steps
    if (stepIndex < step) {
      setStep(stepIndex);
    }
  };

  // Check for existing reservation cookie on mount
  // useEffect(() => {
  //   const savedReservation = Cookies.get('lastReservation');
  //   if (savedReservation) {
  //     try {
  //       const details = JSON.parse(savedReservation);
  //       // setReservationDetails(details);
  //       setIsSuccess(true);
  //     } catch (e) {
  //       console.error('Failed to parse reservation cookie:', e);
  //     }
  //   }
  // }, []);

  // Fetch fresh business hours on component mount
  useEffect(() => {
    const fetchBusinessHours = async () => {
      setIsLoading(true);
      try {
        const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
        if (hoursDoc.exists()) {
          const hours = hoursDoc.data() as BusinessHours;

          setBusinessHours(hours);
        }
      } catch (error) {
        console.error('Error fetching business hours:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessHours();
  }, []); // Empty dependency array means this runs once on mount

  // Fetch general settings (including reservation cutoff)
  useEffect(() => {
    const fetchGeneralSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.reservationCutoffMinutes !== undefined) {
            setReservationCutoffMinutes(data.reservationCutoffMinutes);
          }
        }
      } catch (error) {
        console.error('Error fetching general settings:', error);
      }
    };

    fetchGeneralSettings();
  }, []);

  // Add this useEffect to fetch special dates
  useEffect(() => {
    const loadSpecialDates = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'specialDates'));
        const dates = snapshot.docs.map(doc => doc.data()) as SpecialDate[];
        setSpecialDates(dates);
      } catch (error) {
        console.error('Error loading special dates:', error);
      }
    };

    loadSpecialDates();
  }, []);

  // Update time slots when date or business hours change
  useEffect(() => {
    if (businessHours && selectedDate) {
      const slots = generateTimeSlots(selectedDate, businessHours);
      setAvailableTimeSlots(slots);

      // If current time is not available, clear it
      if (formData.time && !slots.find(slot => slot.time === formData.time)) {
        updateFormData({ time: '' });
      }
    }
  }, [selectedDate, businessHours, reservationCutoffMinutes]);

  // 1. Add helper function to check if we should show next day
  const shouldShowNextDay = (hours: BusinessHours): boolean => {
    const restaurantNow = getRestaurantDate();
    // Use the local day from the restaurant's current date
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = days[restaurantNow.getDay()];
    const currentHours = hours[currentDay];

    if (!currentHours) return true;

    const currentMinutes = restaurantNow.getHours() * 60 + restaurantNow.getMinutes();

    // Convert closing time to minutes
    const timeToMinutes = (timeStr: string): number => {
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);

      // Convert to 24-hour format if needed
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      return hours * 60 + (minutes || 0);
    };

    // Check if we're past dinner closing time or if both periods are closed
    const isDinnerClosed = !currentHours.dinner.isOpen ||
      currentMinutes > timeToMinutes(currentHours.dinner.close) - 30; // 30 min buffer
    const isLunchClosed = !currentHours.lunch.isOpen ||
      currentMinutes > timeToMinutes(currentHours.lunch.close) - 30;

    return isDinnerClosed && isLunchClosed;
  };



  // 3. Add useEffect to handle initial date setting
  useEffect(() => {
    if (businessHours) {
      if (shouldShowNextDay(businessHours)) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        setSelectedDate(tomorrow);
        updateFormData({ date: tomorrow });
      }
    }
  }, [businessHours]); // Only run when business hours are loaded

  // 4. Update the generateTimeSlots function
  const generateTimeSlots = (date: Date, hours: BusinessHours): TimeSlot[] => {
    // Use the local day of the Date object (what the user visually selected)
    // NOT converted to restaurant timezone, because the user picked this calendar date
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[date.getDay()];

    const dayHours = hours[dayOfWeek];
    if (!dayHours) return [];

    const matchingSpecialDate = specialDates.find(specialDate => {
      const holidayDate = new Date(specialDate.date);
      return isSameMonthAndDay(date, holidayDate);
    });
    const closureType = getClosureType(matchingSpecialDate);
    const lunchClosedBySpecialDate = closureType === 'full' || closureType === 'lunch';
    const dinnerClosedBySpecialDate = closureType === 'full' || closureType === 'dinner';

    const slots: TimeSlot[] = [];
    const restaurantNow = getRestaurantDate();
    const isToday = date.toDateString() === restaurantNow.toDateString();
    const currentMinutes = isToday ? restaurantNow.getHours() * 60 + restaurantNow.getMinutes() : 0;

    // Helper function to convert time string to minutes (24-hour format)
    const timeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Helper function to format minutes to time string (12-hour format)
    const minutesToTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    // Process lunch hours
    if (dayHours.lunch.isOpen && !lunchClosedBySpecialDate) {
      if (dayHours.lunch.customRanges && dayHours.lunch.customRanges.length > 0) {
        // Use custom ranges for lunch
        dayHours.lunch.customRanges.forEach(range => {
          let start = timeToMinutes(range.start);
          const end = timeToMinutes(range.end);

          // Skip if the entire range is in the past or within cutoff
          if (isToday && end <= currentMinutes + reservationCutoffMinutes) return;

          // Adjust start time if it's today and in the past
          if (isToday && start < currentMinutes) {
            start = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
          }

          // Last slot must be reservationCutoffMinutes before closing
          for (let time = start; time <= end - reservationCutoffMinutes; time += slotDuration) {
            if (!isToday || time >= currentMinutes + 30) {
              slots.push({
                time: minutesToTime(time),
                period: 'lunch'
              });
            }
          }
        });
      } else {
        // Use regular lunch hours
        let start = timeToMinutes(dayHours.lunch.open);
        const end = timeToMinutes(dayHours.lunch.close);

        if (isToday && start < currentMinutes) {
          start = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
        }

        // Last slot must be reservationCutoffMinutes before closing
        for (let time = start; time <= end - reservationCutoffMinutes; time += slotDuration) {
          if (!isToday || time >= currentMinutes + 30) {
            slots.push({
              time: minutesToTime(time),
              period: 'lunch'
            });
          }
        }
      }
    }

    // Process dinner hours
    if (dayHours.dinner.isOpen && !dinnerClosedBySpecialDate) {
      if (dayHours.dinner.customRanges && dayHours.dinner.customRanges.length > 0) {
        // Use custom ranges for dinner
        dayHours.dinner.customRanges.forEach(range => {
          let start = timeToMinutes(range.start);
          const end = timeToMinutes(range.end);

          // Skip if the entire range is in the past or within cutoff
          if (isToday && end <= currentMinutes + reservationCutoffMinutes) return;

          // Adjust start time if it's today and in the past
          if (isToday && start < currentMinutes) {
            start = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
          }

          // Last slot must be reservationCutoffMinutes before closing
          for (let time = start; time <= end - reservationCutoffMinutes; time += slotDuration) {
            if (!isToday || time >= currentMinutes + 30) {
              slots.push({
                time: minutesToTime(time),
                period: 'dinner'
              });
            }
          }
        });
      } else {
        // Use regular dinner hours
        let start = timeToMinutes(dayHours.dinner.open);
        const end = timeToMinutes(dayHours.dinner.close);

        if (isToday && start < currentMinutes) {
          start = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
        }

        // Last slot must be reservationCutoffMinutes before closing
        for (let time = start; time <= end - reservationCutoffMinutes; time += slotDuration) {
          if (!isToday || time >= currentMinutes + 30) {
            slots.push({
              time: minutesToTime(time),
              period: 'dinner'
            });
          }
        }
      }
    }

    // Helper function to convert 12-hour time string to minutes for sorting
    const timeStringToMinutes = (timeStr: string): number => {
      const [time, period] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);

      // Convert to 24-hour format for proper sorting
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      return hours * 60 + minutes;
    };

    // Update the sort at the end of generateTimeSlots function
    return slots.sort((a, b) => {
      const timeA = timeStringToMinutes(a.time);
      const timeB = timeStringToMinutes(b.time);
      return timeA - timeB;
    });
  };

  const handleDateChange = (date: Date) => {


    // Check if selected date is a holiday
    const holiday = specialDates.find(specialDate => {
      const holidayDate = new Date(specialDate.date);
      return isSameMonthAndDay(date, holidayDate);
    });

    const closureType = getClosureType(holiday);
    if (closureType === 'full') {
      alert(`Sorry, we're closed on this date (${holiday.reason})`);
      return;
    }

    // Create a new date object for the selected date
    const newDate = new Date(date);
    newDate.setHours(12, 0, 0, 0);

    // First update the selected date
    setSelectedDate(newDate);

    // Generate new time slots for the selected date if we have business hours
    if (businessHours) {

      const newSlots = generateTimeSlots(newDate, businessHours);


      // Update available time slots
      setAvailableTimeSlots(newSlots);

      // Update form data with the new date and first available time slot
      updateFormData({
        date: newDate,
        time: newSlots.length > 0 ? newSlots[0].time : ''
      });
    }
  };

  const validateSteps = () => {
    // Validate Step 1 (Date & Time)
    const isStep1Valid = formData.date && formData.time;

    // Validate Step 2 (Guest Information)
    const isStep2Valid =
      formData.name.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.phone.trim() !== '' &&
      formData.guests > 0;

    return {
      isValid: isStep1Valid && isStep2Valid,
      isStep1Valid,
      isStep2Valid
    };
  };

  const handleSubmit = async () => {
    const validation = validateSteps();

    if (!validation.isValid) {
      if (!validation.isStep1Valid) {
        alert('Please complete all required fields in Date & Time');
        setStep(0);
        return;
      }
      if (!validation.isStep2Valid) {
        alert('Please complete all required fields in Guest Information');
        setStep(1);
        return;
      }
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert the date to YYYY-MM-DD string
      // Use local timezone because the user picked the date visually on their calendar
      // The date picker shows dates in local time, so we extract the local date they selected
      let dateToSend: string;
      if (formData.date instanceof Date) {
        // Extract the local date components (what the user visually selected)
        const year = formData.date.getFullYear();
        const month = String(formData.date.getMonth() + 1).padStart(2, '0');
        const day = String(formData.date.getDate()).padStart(2, '0');
        dateToSend = `${year}-${month}-${day}`;
      } else {
        dateToSend = formData.date;
      }

      const submissionData = {
        ...formData,
        date: dateToSend // Send as YYYY-MM-DD string (the calendar date user selected)
      };

      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData: submissionData, timezone }),
      });

      const data = await response.json();

      if (data.success) {
        // Store the reservationId in a separate cookie
        if (data.reservationId) {
          Cookies.set('reservationId', data.reservationId);
        }

        // Store the reservation details in lastReservation cookie
        Cookies.set('lastReservation', JSON.stringify(data.reservationDetails), { expires: 1 });

        setReservationDetails(data.reservationDetails);
        setIsSuccess(true);
        setFormData(initialData);
      } else {
        throw new Error(data.error || 'Failed to submit reservation');
      }
    } catch (error) {
      alert('Failed to submit reservation. Please try again.');
      console.error('Submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const SuccessScreen = () => (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Reservation Confirmed!
      </h2>
      {reservationDetails && (
        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Reservation Details</h3>
          <p className="text-gray-600">Name: {reservationDetails.name}</p>
          <p className="text-gray-600">Date: {
            // Use formattedDate from API if available, otherwise format the date
            formatDisplayDate2(reservationDetails.date)
          }</p>
          <p className="text-gray-600">Time: {reservationDetails.time}</p>
          <p className="text-gray-600">Guests: {reservationDetails.guests}</p>
          <p className="text-gray-600">Email: {reservationDetails.email}</p>
        </div>
      )}

      {/* <CancelButton reservationId={reservationDetails?.reservationId || ""} /> */}

      <button
        onClick={() => {
          setIsSuccess(false);
          setStep(0);
          Cookies.remove('lastReservation');
          setReservationDetails(null);
        }}
        className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Home
        <ChevronRight className="w-4 h-4 ml-2" />
      </button>
    </div>
  );

  // Add useEffect to fetch menu items
  useEffect(() => {
    const fetchMenuItems = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'menu'));
        const items = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as MenuItem[];
        setMenuItems(items);
      } catch (error) {
        console.error('Error fetching menu:', error);
      }
    };

    fetchMenuItems();
  }, []);

  if (isLoading || timezoneLoading || !selectedDate) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <div className="text-center">
          <p className="text-gray-800 font-semibold">Loading Reservation System</p>
          <p className="text-gray-500 text-sm">Please wait while we fetch available times...</p>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gray-50"
    >
      <Navbar />
      <Banner />

      {isSuccess ? (
        <main className="max-w-2xl mx-auto px-4 py-10">
          <SuccessScreen />
        </main>
      ) : (
        <>
          {/* Step 0: Landing Page with Hero + Signature Dishes */}
          {step === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            >
              {/* Hero Section */}
              <div className="relative h-[50vh] md:h-[55vh] w-full">
                <div className="absolute inset-0">
                  <div className="absolute inset-0 bg-black/50 z-10"></div>
                  <img
                    src="/images/thai_food_hero.jpeg"
                    alt="Thai Food"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="relative z-20 h-full flex flex-col items-center justify-center px-4">
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 text-center">
                    Thaiphoon Restaurant
                  </h1>
                  <p className="text-white/80 text-lg mb-8 text-center">
                    Book your table today
                  </p>

                  {/* Inline Reservation Picker */}
                  <div className="w-full max-w-3xl px-2">
                    {/* Mobile: Stacked layout */}
                    <div className="flex flex-col sm:hidden gap-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <ThemeProvider theme={theme}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                              <MuiDatePicker
                                value={selectedDate}
                                onChange={(newDate) => {
                                  if (newDate) {
                                    newDate.setHours(12, 0, 0, 0);
                                    handleDateChange(newDate);
                                  }
                                }}
                                sx={{
                                  width: '100%',
                                  '& .MuiOutlinedInput-root': {
                                    height: '48px',
                                    backgroundColor: 'white',
                                    borderRadius: '8px',
                                    '& .MuiOutlinedInput-input': {
                                      padding: '12px 14px',
                                      fontSize: '0.875rem',
                                    },
                                    '& fieldset': { borderColor: 'transparent' },
                                    '&:hover fieldset': { borderColor: 'transparent' },
                                    '&.Mui-focused fieldset': { borderColor: 'transparent' }
                                  },
                                }}
                                disablePast
                                shouldDisableDate={(date) => {
                                  return specialDates.some(specialDate => {
                                    const holidayDate = new Date(specialDate.date);
                                    return isSameMonthAndDay(date, holidayDate) && getClosureType(specialDate) === 'full';
                                  });
                                }}
                              />
                            </LocalizationProvider>
                          </ThemeProvider>
                        </div>
                        <select
                          value={formData.time}
                          onChange={(e) => updateFormData({ time: e.target.value })}
                          className="flex-1 h-[48px] px-3 rounded-lg bg-white text-sm focus:outline-none"
                        >
                          <option value="">Time</option>
                          {availableTimeSlots.map((slot) => (
                            <option key={slot.time} value={slot.time}>{slot.time}</option>
                          ))}
                        </select>
                        <select
                          value={formData.guests || ""}
                          onChange={(e) => updateFormData({ guests: Number(e.target.value) })}
                          className="w-24 h-[48px] px-3 rounded-lg bg-white text-sm focus:outline-none"
                        >
                          <option value="">Guests</option>
                          {[...Array(20)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => {
                          if (formData.date && formData.time && formData.guests) {
                            setStep(1);
                          } else {
                            toast.error('Please select date, time, and number of guests');
                          }
                        }}
                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-lg group relative overflow-hidden"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-shimmer-slide" />
                        <span className="relative flex items-center justify-center">
                          Reserve Now
                          <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </button>
                    </div>

                    {/* Desktop: Inline layout */}
                    <div className="hidden sm:flex items-center bg-white rounded-lg shadow-2xl overflow-hidden">
                      {/* Date */}
                      <div className="flex-1 min-w-0">
                        <ThemeProvider theme={theme}>
                          <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <MuiDatePicker
                              value={selectedDate}
                              onChange={(newDate) => {
                                if (newDate) {
                                  newDate.setHours(12, 0, 0, 0);
                                  handleDateChange(newDate);
                                }
                              }}
                              sx={{
                                width: '100%',
                                '& .MuiOutlinedInput-root': {
                                  height: '52px',
                                  backgroundColor: 'white',
                                  '& .MuiOutlinedInput-input': {
                                    padding: '14px 16px',
                                    fontSize: '0.9rem',
                                  },
                                  '& fieldset': { border: 'none' },
                                  '&:hover fieldset': { border: 'none' },
                                  '&.Mui-focused fieldset': { border: 'none' }
                                },
                              }}
                              disablePast
                              shouldDisableDate={(date) => {
                                return specialDates.some(specialDate => {
                                  const holidayDate = new Date(specialDate.date);
                                  return isSameMonthAndDay(date, holidayDate) && getClosureType(specialDate) === 'full';
                                });
                              }}
                            />
                          </LocalizationProvider>
                        </ThemeProvider>
                      </div>

                      {/* Divider */}
                      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />

                      {/* Time */}
                      <select
                        value={formData.time}
                        onChange={(e) => updateFormData({ time: e.target.value })}
                        className="flex-1 min-w-0 h-[52px] px-4 bg-white text-sm focus:outline-none border-none text-center"
                      >
                        <option value="">Time</option>
                        {availableTimeSlots.map((slot) => (
                          <option key={slot.time} value={slot.time}>{slot.time}</option>
                        ))}
                      </select>

                      {/* Divider */}
                      <div className="w-px h-8 bg-gray-200 flex-shrink-0" />

                      {/* Guests */}
                      <select
                        value={formData.guests || ""}
                        onChange={(e) => updateFormData({ guests: Number(e.target.value) })}
                        className="flex-1 min-w-0 h-[52px] px-4 bg-white text-sm focus:outline-none border-none text-center"
                      >
                        <option value="">Guests</option>
                        {[...Array(20)].map((_, i) => (
                          <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'guest' : 'guests'}</option>
                        ))}
                      </select>

                      {/* Reserve Button */}
                      <button
                        onClick={() => {
                          if (formData.date && formData.time && formData.guests) {
                            setStep(1);
                          } else {
                            toast.error('Please select date, time, and number of guests');
                          }
                        }}
                        className="flex-shrink-0 h-[52px] px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-r-lg transition-all duration-300 hover:scale-105 group relative overflow-hidden"
                      >
                        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-shimmer-slide" />
                        <span className="relative flex items-center">
                          Reserve Now
                          <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </button>
                    </div>

                    <p className="text-xs text-white/60 text-center mt-3">
                      All times in {getTimezoneLabel(timezone)}
                    </p>
                  </div>

                  <Link href="/menu" className="mt-6 text-white/80 hover:text-white text-sm transition-colors">
                    Browse Our Full Menu →
                  </Link>
                </div>
              </div>

              {/* Signature Dishes Section */}
              {menuItems.filter(item => item.category === 'Signature Dishes').length > 0 && (
                <div className="bg-white py-12 md:py-16">
                  <div className="max-w-6xl mx-auto px-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2 text-center">
                      Our Signature Dishes
                    </h2>
                    <p className="text-gray-600 text-center mb-8">
                      Explore our most popular Thai dishes
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {menuItems
                        .filter(item => item.category === 'Signature Dishes')
                        .map((item) => (
                          <Card key={item.id} className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow">
                            <div className="h-48 w-full">
                              <img
                                src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Dish"}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <CardContent className="p-4">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {item.name}
                              </h3>
                              <p className="text-gray-600 text-sm line-clamp-2">
                                {item.description}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                    <div className="text-center mt-8">
                      <Link href="/menu">
                        <Button variant="outline" className="border-gray-300">
                          View Full Menu
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Step 1: Finalize Reservation */}
          {step === 1 && (
            <main className="max-w-xl mx-auto px-4 py-8 md:py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Back Button */}
                <Button
                  variant="ghost"
                  onClick={prevStep}
                  className="mb-4 -ml-2 text-gray-600 hover:text-gray-900"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>

                <Card className="border-0 shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Complete Your Reservation</CardTitle>
                    <CardDescription>
                      Enter your details to finalize the booking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Reservation Summary */}
                    <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          {selectedDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Clock className="w-4 h-4 text-gray-500" />
                          {formData.time}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-700">
                          <Users className="w-4 h-4 text-gray-500" />
                          {formData.guests} {formData.guests === 1 ? 'guest' : 'guests'}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={prevStep}
                        className="text-gray-500 hover:text-gray-700 text-xs"
                      >
                        Edit
                      </Button>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="name" className="text-gray-700">Full Name *</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="name"
                            type="text"
                            placeholder="John Doe"
                            value={formData.name}
                            onChange={(e) => updateFormData({ name: e.target.value })}
                            className="pl-10 h-11"
                          />
                        </div>
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-gray-700">Email Address *</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="john@example.com"
                            value={formData.email}
                            onChange={(e) => updateFormData({ email: e.target.value })}
                            className="pl-10 h-11"
                          />
                        </div>
                        <p className="text-xs text-gray-500">We'll send your confirmation here</p>
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-gray-700">Phone Number *</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            id="phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={formData.phone}
                            onChange={(e) => updateFormData({ phone: e.target.value })}
                            className="pl-10 h-11"
                          />
                        </div>
                      </div>

                      {/* Special Requests */}
                      <div className="space-y-2">
                        <Label htmlFor="comments" className="text-gray-700">Special Requests (optional)</Label>
                        <Textarea
                          id="comments"
                          placeholder="Any dietary restrictions, allergies, or special occasions?"
                          value={formData.comments}
                          onChange={(e) => updateFormData({ comments: e.target.value })}
                          rows={3}
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      onClick={() => {
                        const validation = validateSteps();
                        if (validation.isValid) {
                          handleSubmit();
                        } else {
                          if (!formData.name.trim()) {
                            toast.error('Please enter your name');
                          } else if (!formData.email.trim()) {
                            toast.error('Please enter your email');
                          } else if (!formData.phone.trim()) {
                            toast.error('Please enter your phone number');
                          }
                        }
                      }}
                      disabled={isSubmitting}
                      className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white font-medium"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          Confirm Reservation
                          <Check className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>

                    <p className="text-center text-gray-500 text-xs">
                      By confirming, you agree to our reservation policy
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            </main>
          )}
        </>
      )}
    </motion.div>
  );
}

// getPSTDate function has been replaced by getRestaurantDate in the component
// which uses the timezone from the TimezoneContext