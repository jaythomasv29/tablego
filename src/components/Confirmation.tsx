'use client';

import React from 'react';
import { Calendar, Users, User, Mail, Phone, MessageSquare, Check, Loader2 } from 'lucide-react';
import { ReservationData } from './ReservationForm';

interface ConfirmationProps {
  formData: ReservationData;
  onSubmit: () => void;
  isSubmitting: boolean;
  isValid: boolean;
}

const Confirmation: React.FC<ConfirmationProps> = ({ formData, onSubmit, isSubmitting, isValid }) => {
  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start space-x-3 py-3">
      <Icon className="w-5 h-5 text-gray-500 mt-0.5" />
      <div>
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <p className="text-base text-gray-900">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Confirm Your Reservation
      </h2>

      <div className="bg-gray-50 rounded-xl p-6 space-y-2">
        <InfoRow
          icon={Calendar}
          label="Date & Time"
          value={`${formData.date.toLocaleDateString()} at ${formData.time}`}
        />
        <InfoRow
          icon={Users}
          label="Number of Guests"
          value={`${formData.guests} ${formData.guests === 1 ? 'Guest' : 'Guests'}`}
        />
        <InfoRow
          icon={User}
          label="Name"
          value={formData.name}
        />
        <InfoRow
          icon={Mail}
          label="Email"
          value={formData.email}
        />
        <InfoRow
          icon={Phone}
          label="Phone"
          value={formData.phone}
        />
        {formData.comments && (
          <InfoRow
            icon={MessageSquare}
            label="Special Requests"
            value={formData.comments}
          />
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={isSubmitting || !isValid}
        className={`${isValid
          ? 'bg-indigo-600 hover:bg-indigo-700'
          : 'bg-gray-400 cursor-not-allowed'
          } text-white px-6 py-2 rounded-lgtransition-colors`}
      >
        {isSubmitting ? 'Submitting...' : 'Confirm Reservation'}
      </button>

      <p className="text-sm text-gray-500 text-center">
        By confirming, you agree to our reservation policy. A confirmation email will be sent to your email address.
      </p>
    </div>
  );
};

export default Confirmation;