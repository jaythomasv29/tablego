'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Users, Mail, MessageSquare } from 'lucide-react';
import DatePicker from './DatePicker';
import GuestInfo from './GuestInfo';
// import AdditionalInfo from './AdditionalInfo';
// import Confirmation from './Confirmation';
import ProgressBar from './ProgressBar';
import Cookies from 'js-cookie';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { CancelButton } from './CancelButton';
import Navbar from './Navbar';
import { TimeSlot } from '@/types/TimeSlot';
// import { usePageTracking } from './usePageTracking';
import dynamic from 'next/dynamic';

// Lazy load components that aren't needed immediately
const AdditionalInfo = dynamic(() => import('./AdditionalInfo'));
const Confirmation = dynamic(() => import('./Confirmation'));
// const SuccessScreen = dynamic(() => import('./SuccessScreen'));

export type ReservationData = {
  date: Date;
  time: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  comments: string;
};

const initialData: ReservationData = {
  date: new Date(),
  time: '19:00',
  guests: 2,
  name: '',
  email: '',
  phone: '',
  comments: '',
};

type ReservationDetails = {
  reservationId: string;
  name: string;
  date: string;
  time: string;
  guests: number;
  email: string;
};


interface BusinessHours {
  [key: string]: {
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
  };
}

const slotDuration = 30; // If it's a fixed value

interface SpecialDate {
  date: string;
  reason: string;
}

const isSameMonthAndDay = (date1: Date, date2: Date): boolean => {
  return date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

export default function ReservationForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reservationDetails, setReservationDetails] = useState<ReservationDetails | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const pstToday = getPSTDate();
    pstToday.setHours(12, 0, 0, 0);
    return pstToday;
  });
  // usePageTracking();
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  //  (businessHours)
  //  ('Generating time slots for:', selectedDate);
  // etc...
  const steps = [
    { title: 'Date & Time', icon: Calendar },
    { title: 'Guest Information', icon: Users },
    { title: 'Additional Details', icon: MessageSquare },
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
  useEffect(() => {
    const savedReservation = Cookies.get('lastReservation');
    if (savedReservation) {
      try {
        const details = JSON.parse(savedReservation);
        setReservationDetails(details);
        setIsSuccess(true);
      } catch (e) {
        console.error('Failed to parse reservation cookie:', e);
      }
    }
  }, []);

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

      const newSlots = generateTimeSlots(selectedDate, businessHours);
      setAvailableTimeSlots(newSlots);

      // If we have slots and no time is selected, select the first available slot
      if (newSlots.length > 0 && !formData.time) {
        updateFormData({
          time: newSlots[0].time
        });
      }
    }
  }, [selectedDate, businessHours]);

  // 1. Add helper function to check if we should show next day
  const shouldShowNextDay = (hours: BusinessHours): boolean => {
    const pstNow = getPSTDate();
    const currentDay = pstNow.toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: "America/Los_Angeles"
    }).toLowerCase();
    const currentHours = hours[currentDay];

    if (!currentHours) return true;

    const currentMinutes = pstNow.getHours() * 60 + pstNow.getMinutes();

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

  // 2. Update the initial date state
  // const [selectedDate, setSelectedDate] = useState<Date>(() => {
  //   const today = new Date();
  //   today.setHours(0, 0, 0, 0);
  //   return today;
  // });

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

  // 4. Update the generateTimeSlots function to handle next day logic
  const generateTimeSlots = (date: Date, hours: BusinessHours): TimeSlot[] => {
    // First check if the date is a holiday
    const isHoliday = specialDates.some(specialDate => {
      const holidayDate = new Date(specialDate.date);
      return isSameMonthAndDay(date, holidayDate);
    });

    // If it's a holiday, return empty array (no time slots available)
    if (isHoliday) {
      return [];
    }

    const pstNow = getPSTDate();
    const isToday = date.toDateString() === pstNow.toDateString();
    const currentMinutes = isToday ? pstNow.getHours() * 60 + pstNow.getMinutes() : 0;

    const dayOfWeek = date.toLocaleDateString('en-US', {
      weekday: 'long'
    }).toLowerCase();

    const dayHours = hours[dayOfWeek];
    const lunchSlots: TimeSlot[] = [];
    const dinnerSlots: TimeSlot[] = [];

    if (!dayHours) return [];

    // Helper to convert "HH:mm" to minutes since midnight
    const timeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + minutes;
    };

    // Helper to convert minutes to "HH:mm AM/PM" format
    const minutesToTime = (minutes: number): string => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    // Helper to convert "H:mm AM/PM" to minutes for sorting
    const timeStringToMinutes = (timeStr: string): number => {
      // Split into time and period (e.g., "1:00" and "PM")
      const [timeComponent, period] = timeStr.trim().split(' ');

      // Split hours and minutes
      const [hoursStr, minutesStr] = timeComponent.split(':');
      let hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);

      // Convert to 24-hour format
      if (period === 'PM' && hours !== 12) {
        hours += 12;
      } else if (period === 'AM' && hours === 12) {
        hours = 0;
      }

      return (hours * 60) + minutes;
    };

    // Generate lunch slots
    if (dayHours.lunch.isOpen) {
      let startMinutes = timeToMinutes(dayHours.lunch.open);
      const endMinutes = timeToMinutes(dayHours.lunch.close) - 30;

      while (startMinutes <= endMinutes) {
        if (!isToday || startMinutes > currentMinutes + 30) {
          lunchSlots.push({
            period: 'lunch',
            time: minutesToTime(startMinutes),
            startTime: minutesToTime(startMinutes),
            endTime: minutesToTime(startMinutes + slotDuration)
          });
        }
        startMinutes += slotDuration;
      }
    }

    // Generate dinner slots
    if (dayHours.dinner.isOpen) {
      let startMinutes = timeToMinutes(dayHours.dinner.open);
      const endMinutes = timeToMinutes(dayHours.dinner.close) - 30;

      while (startMinutes <= endMinutes) {
        if (!isToday || startMinutes > currentMinutes + 30) {
          dinnerSlots.push({
            period: 'dinner',
            time: minutesToTime(startMinutes),
            startTime: minutesToTime(startMinutes),
            endTime: minutesToTime(startMinutes + slotDuration)
          });
        }
        startMinutes += slotDuration;
      }
    }

    // Sort lunch and dinner slots by time
    const sortByTime = (a: TimeSlot, b: TimeSlot) => {
      const minutesA = timeStringToMinutes(a.time);
      const minutesB = timeStringToMinutes(b.time);
      return minutesA - minutesB;
    };

    // Sort lunch slots separately
    const sortedLunchSlots = [...lunchSlots].sort(sortByTime);
    const sortedDinnerSlots = [...dinnerSlots].sort(sortByTime);

    return [...sortedLunchSlots, ...sortedDinnerSlots];
  };

  const handleDateChange = (date: Date) => {


    // Check if selected date is a holiday
    const holiday = specialDates.find(specialDate => {
      const holidayDate = new Date(specialDate.date);
      return isSameMonthAndDay(date, holidayDate);
    });

    if (holiday) {
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
      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ formData }),
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
          <p className="text-gray-600">Date: {reservationDetails.date}</p>
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

  if (isLoading) return (
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          {isSuccess ? (
            <SuccessScreen />
          ) : (
            <>
              {step > 0 && (
                <button
                  onClick={prevStep}
                  className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  <span className="text-sm font-medium">Back to {steps[step - 1].title}</span>
                </button>
              )}

              <ProgressBar
                currentStep={step}
                steps={steps}
                onStepClick={handleStepClick}
              />

              <div className="mt-8">
                {step === 0 && (
                  <>
                    <DatePicker
                      date={selectedDate}
                      time={formData.time}
                      onUpdate={(date: Date, time: string) => {
                        updateFormData({ date, time });
                        setSelectedDate(date);
                      }}
                      onDateChange={handleDateChange}
                      availableTimeSlots={availableTimeSlots}
                      specialDates={specialDates}
                    />
                  </>
                )}
                {step === 1 && (
                  <GuestInfo
                    formData={formData}
                    onUpdate={updateFormData}
                  />
                )}
                {step === 2 && (
                  <AdditionalInfo
                    comments={formData.comments}
                    onUpdate={updateFormData}
                  />
                )}
                {step === 3 && (
                  <Confirmation
                    formData={formData}
                    onSubmit={handleSubmit}
                    isSubmitting={isSubmitting}
                    isValid={!!validateSteps().isValid}
                  />
                )}
              </div>

              <div className="mt-8 flex justify-between">
                {step > 0 && (
                  <button
                    onClick={prevStep}
                    disabled={isSubmitting}
                    className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>
                )}
                {step < steps.length - 1 && (
                  <button
                    onClick={nextStep}
                    disabled={isSubmitting}
                    className="ml-auto flex items-center px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

const getPSTDate = (date?: Date): Date => {
  const targetDate = date || new Date();
  return new Date(
    targetDate.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    })
  );
};