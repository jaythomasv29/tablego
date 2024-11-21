'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Users, Mail, MessageSquare } from 'lucide-react';
import DatePicker from './DatePicker';
import GuestInfo from './GuestInfo';
import AdditionalInfo from './AdditionalInfo';
import Confirmation from './Confirmation';
import ProgressBar from './ProgressBar';
import Cookies from 'js-cookie';
import { db } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import CancelButton from './CancelButton';
import Navbar from './Navbar';


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

interface CancelButtonProps {
  reservationId: string;
}

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

interface TimeSlot {
  time: string;
  period: 'lunch' | 'dinner';
}

export default function ReservationForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [reservationDetails, setReservationDetails] = useState<ReservationDetails | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(initialData.date);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  console.log(businessHours)
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
          setBusinessHours(hoursDoc.data() as BusinessHours);
        }
      } catch (error) {
        console.error('Error fetching business hours:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinessHours();
  }, []); // Empty dependency array means this runs once on mount

  // Update time slots when date or business hours change
  useEffect(() => {
    if (selectedDate && businessHours) {
      const newSlots = generateTimeSlots(selectedDate, businessHours);
      setAvailableTimeSlots(newSlots);
    }
  }, [selectedDate, businessHours]);

  const generateTimeSlots = (date: Date, hours: BusinessHours): TimeSlot[] => {
    const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const dayHours = hours[dayOfWeek];
    const slots: TimeSlot[] = [];

    if (!dayHours) return slots;

    const generateSlotsForPeriod = (
      start: string,
      end: string,
      period: 'lunch' | 'dinner'
    ) => {
      const startTime = new Date(`2000-01-01T${start}`);
      const endTime = new Date(`2000-01-01T${end}`);
      const periodSlots: TimeSlot[] = [];

      // Generate slots in 30-minute intervals
      while (startTime < endTime) {
        periodSlots.push({
          time: startTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          period
        });
        startTime.setMinutes(startTime.getMinutes() + 30);
      }
      return periodSlots;
    };

    // Generate lunch slots if open
    if (dayHours.lunch.isOpen) {
      slots.push(...generateSlotsForPeriod(
        dayHours.lunch.open,
        dayHours.lunch.close,
        'lunch'
      ));
    }

    // Generate dinner slots if open
    if (dayHours.dinner.isOpen) {
      slots.push(...generateSlotsForPeriod(
        dayHours.dinner.open,
        dayHours.dinner.close,
        'dinner'
      ));
    }

    // Filter out past times if the date is today
    const today = new Date();
    if (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    ) {
      const currentTime = today.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      return slots.filter(slot => slot.time > currentTime);
    }

    return slots;
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  const handleSubmit = async () => {
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

      <CancelButton reservationId={reservationDetails?.reservationId || ""} />

      <button
        onClick={() => {
          setIsSuccess(false);
          setStep(0);
          Cookies.remove('lastReservation');
          setReservationDetails(null);
        }}
        className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Make Another Reservation
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
                      date={formData.date}
                      time={formData.time}
                      onUpdate={(date: Date, time: string) => updateFormData({ date, time })}
                      onDateChange={handleDateChange}
                      availableTimeSlots={availableTimeSlots}
                    />
                    <div className="mt-4 p-4 bg-yellow-100 text-yellow-800 rounded-lg">
                      *For same day reservations please call (650) 323-7700 for assistance.
                    </div>
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