import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Utensils, Calendar, Users, Mail, MessageSquare } from 'lucide-react';
import DateTimePicker from './components/DatePicker';
import GuestInfo from './components/GuestInfo';
import AdditionalInfo from './components/AdditionalInfo';
import Confirmation from './components/Confirmation';
import ProgressBar from './components/ProgressBar';

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

function App() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);

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
    // In production, this would be a real API endpoint
    console.log('Reservation submitted:', formData);
    // Simulate success
    alert('Reservation confirmed! Check your email for details.');
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
          <ProgressBar currentStep={step} steps={steps} />

          <div className="mt-8">
            {step === 0 && (
              <DateTimePicker
                date={formData.date}
                time={formData.time}
                onUpdate={(date: Date, time: string) => updateFormData({ date, time })}
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