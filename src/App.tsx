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
import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';

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

// Spice poll options
const SPICE_OPTIONS = [
  { id: 'none', label: 'No spice', emoji: '🚫', color: 'bg-gray-400' },
  { id: 'mild', label: 'Mild', emoji: '🌶️', color: 'bg-green-500' },
  { id: 'medium', label: 'Medium', emoji: '🌶️🌶️', color: 'bg-yellow-500' },
  { id: 'hot', label: 'Hot', emoji: '🌶️🌶️🌶️', color: 'bg-orange-500' },
  { id: 'very-hot', label: 'Very Hot', emoji: '🌶️🌶️🌶️🌶️', color: 'bg-red-500' },
  { id: 'extreme', label: 'Extreme', emoji: '🌶️🌶️🌶️🌶️🌶️', color: 'bg-red-700' },
];

interface PollResults {
  none: number;
  mild: number;
  medium: number;
  hot: number;
  'very-hot': number;
  extreme: number;
  total: number;
}

function App() {
  const { timezone, loading: timezoneLoading } = useTimezone();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialDates] = useState<SpecialDate[]>([]); // Initialize with empty array

  // Poll state
  const [hasVoted, setHasVoted] = useState(false);
  const [pollResults, setPollResults] = useState<PollResults | null>(null);
  const [isVoting, setIsVoting] = useState(false);

  // Check if user has already voted and fetch poll results
  useEffect(() => {
    const checkVoteStatus = async () => {
      const voted = localStorage.getItem('spice-poll-voted');
      if (voted) {
        setHasVoted(true);
      }

      // Fetch current poll results
      try {
        const pollRef = doc(db, 'polls', 'spice-preference');
        const pollDoc = await getDoc(pollRef);

        if (pollDoc.exists()) {
          setPollResults(pollDoc.data() as PollResults);
        } else {
          // Initialize poll document if it doesn't exist
          const initialPoll: PollResults = {
            none: 0,
            mild: 0,
            medium: 0,
            hot: 0,
            'very-hot': 0,
            extreme: 0,
            total: 0
          };
          await setDoc(pollRef, initialPoll);
          setPollResults(initialPoll);
        }
      } catch (error) {
        console.error('Error fetching poll:', error);
      }
    };

    checkVoteStatus();
  }, []);

  // Handle voting
  const handleVote = async (optionId: string) => {
    if (hasVoted || isVoting) return;

    setIsVoting(true);
    try {
      const pollRef = doc(db, 'polls', 'spice-preference');
      await updateDoc(pollRef, {
        [optionId]: increment(1),
        total: increment(1)
      });

      // Update local state
      setPollResults(prev => prev ? {
        ...prev,
        [optionId]: (prev[optionId as keyof PollResults] as number) + 1,
        total: prev.total + 1
      } : null);

      // Mark as voted in localStorage
      localStorage.setItem('spice-poll-voted', optionId);
      setHasVoted(true);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };

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

        {/* Spice Poll Section */}
        <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 border border-gray-100">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">
              🔥 How spicy do you like it?
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {hasVoted ? 'Thanks for voting! Here are the results:' : 'Vote and see what others prefer!'}
            </p>
          </div>

          {!hasVoted ? (
            // Voting buttons
            <div className="flex flex-wrap justify-center gap-2">
              {SPICE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleVote(option.id)}
                  disabled={isVoting}
                  className={`flex flex-col items-center px-3 py-2 rounded-xl border-2 border-transparent hover:border-gray-300 hover:bg-gray-50 transition-all ${isVoting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'
                    }`}
                >
                  <span className="text-xl">{option.emoji}</span>
                  <span className="text-[10px] text-gray-500 mt-1">{option.label}</span>
                </button>
              ))}
            </div>
          ) : pollResults ? (
            // Results view
            <div className="space-y-3">
              {/* Segmented bar */}
              <div className="h-6 rounded-full overflow-hidden flex bg-gray-200">
                {SPICE_OPTIONS.map((option) => {
                  const count = pollResults[option.id as keyof PollResults] as number;
                  const percentage = pollResults.total > 0 ? (count / pollResults.total) * 100 : 0;
                  if (percentage === 0) return null;
                  return (
                    <div
                      key={option.id}
                      className={`${option.color} relative group flex items-center justify-center transition-all`}
                      style={{ width: `${percentage}%` }}
                    >
                      {percentage > 8 && (
                        <span className="text-white text-[10px] font-medium">
                          {option.emoji}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                {SPICE_OPTIONS.map((option) => {
                  const count = pollResults[option.id as keyof PollResults] as number;
                  const percentage = pollResults.total > 0 ? ((count / pollResults.total) * 100).toFixed(0) : 0;
                  return (
                    <div key={option.id} className="flex items-center gap-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${option.color}`} />
                      <span className="text-gray-600">
                        {option.emoji} {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Total votes */}
              <p className="text-center text-xs text-gray-400">
                {pollResults.total.toLocaleString()} {pollResults.total === 1 ? 'vote' : 'votes'}
              </p>
            </div>
          ) : (
            // Loading state
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;