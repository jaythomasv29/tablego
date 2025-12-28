import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Utensils, Calendar, Users, Mail, MessageSquare } from 'lucide-react';
import DatePicker from './components/DatePicker';
import GuestInfo from './components/GuestInfo';
import AdditionalInfo from './components/AdditionalInfo';
import Confirmation from './components/Confirmation';
import ProgressBar from './components/ProgressBar';
import { TimeSlot } from './types/TimeSlot';
import { useTimezone } from './contexts/TimezoneContext';
import { getDateInTimezone } from './utils/dateUtils';

export interface ReservationData {
  date: Date;
  time: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  comments: string;
}

const initialData: ReservationData = {
  date: new Date(),
  time: '19:00',
  guests: 2,
  name: '',
  email: '',
  phone: '',
  comments: '',
};

// interface TimeSlot {
//   time: string;
// }

// Add SpecialDate interface
interface SpecialDate {
  date: string;
  reason: string;
}

function App() {
  const { timezone, loading: timezoneLoading } = useTimezone();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialDates] = useState<SpecialDate[]>([]); // Initialize with empty array

  // Update the initial date to use the restaurant's timezone once loaded
  useEffect(() => {
    if (!timezoneLoading && timezone) {
      const restaurantToday = getDateInTimezone(new Date(), timezone);
      setFormData(prev => ({
        ...prev,
        date: restaurantToday
      }));
    }
  }, [timezone, timezoneLoading]);

  const steps = [
    { title: 'Date & Time', icon: Calendar },
    { title: 'Guest Information', icon: Users },
    { title: 'Additional Details', icon: MessageSquare },
    { title: 'Confirmation', icon: Mail },
  ];

  const updateFormData = (data: Partial<ReservationData>) => {
    setFormData(prev => ({
      ...prev,
      ...data
    }));
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // In production, this would be a real API endpoint

      // Simulate success
      alert('Reservation confirmed! Check your email for details.');
    } catch (error) {
      // Handle error
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (date: Date) => {
    // Convert the selected date to the restaurant's timezone
    const dateInTimezone = getDateInTimezone(date, timezone);
    setFormData((prev) => ({ ...prev, date: dateInTimezone }));
  };

  const availableTimeSlots = [
    // Define your available time slots here
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    // ...
  ];

  const handleUpdate = (updatedData: Date) => {
    // Handle the update logic here
    setFormData(prev => ({ ...prev, ...updatedData }));
  };

  // Add validation function at the component level
  const validateSteps = (): boolean => {
    // Validate Step 1 (Date & Time)
    const isStep1Valid = Boolean(formData.date && formData.time);

    // Validate Step 2 (Guest Information)
    const isStep2Valid = Boolean(
      formData.name.trim() !== '' &&
      formData.email.trim() !== '' &&
      formData.phone.trim() !== '' &&
      formData.guests > 0
    );

    return isStep1Valid && isStep2Valid;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Utensils className="h-6 w-6 text-indigo-600" />
              <span className="text-xl font-semibold text-gray-900">Thaiphoon Restaurant</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <ProgressBar
            currentStep={step}
            steps={steps}
            onStepClick={(index) => setStep(index)}
          />

          <div className="mt-8">
            {step === 0 && (
              <DatePicker
                date={formData.date}
                time={formData.time}
                onUpdate={handleUpdate}
                onDateChange={handleDateChange}
                availableTimeSlots={availableTimeSlots.map(time => ({
                  startTime: new Date().toISOString(),  // Convert to ISO string
                  endTime: new Date().toISOString(),    // Convert to ISO string
                  period: 'lunch',        // You'll need to determine if lunch or dinner
                  time: time
                }))}
                specialDates={specialDates}
              />
            )}
            {step === 1 && (
              <GuestInfo
                formData={formData}
                onUpdate={(data: Partial<ReservationData>) => updateFormData(data)}
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
                isValid={validateSteps()}
              />
            )}
          </div>

          <div className="mt-8 flex justify-between">
            {step > 0 && (
              <button
                onClick={prevStep}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </button>
            )}
            {step < steps.length - 1 && (
              <button
                onClick={nextStep}
                className="ml-auto flex items-center px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;