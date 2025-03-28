'use client';

import React, { useState } from 'react';
import { Calendar, Users, User, Mail, Phone, MessageSquare, Check, Loader2 } from 'lucide-react';
import { ReservationData } from './ReservationForm';
import PolicyModal from './PolicyModal';

interface ConfirmationProps {
  formData: ReservationData;
  onSubmit: () => void;
  isSubmitting: boolean;
  isValid: boolean;
}

const Confirmation: React.FC<ConfirmationProps> = ({ formData, onSubmit, isSubmitting, isValid }) => {
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-start space-x-3 py-3">
      <Icon className="w-5 h-5 text-gray-500 mt-0.5" />
      <div>
        <div className="text-sm font-medium text-gray-500">{label}</div>
        <div className="text-base text-gray-900">{value}</div>
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

      <div className="flex flex-col items-end space-y-4">
        <p className="text-sm text-gray-500 text-center w-full">
          By confirming, you agree to our <span className="text-indigo-600 cursor-pointer" onClick={() => setIsPolicyModalOpen(true)}>reservation policy</span>. A confirmation email will be sent to your email address.
        </p>
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !isValid}
          className={`${isValid
            ? 'bg-indigo-600 hover:bg-indigo-700'
            : 'bg-gray-400 cursor-not-allowed'
            } text-white px-6 py-2 rounded-lg transition-colors w-full sm:w-auto`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </span>
          ) : (
            'Confirm Reservation'
          )}
        </button>
      </div>

      <PolicyModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
      >
        <p className="mb-2">Thank you for choosing to dine with us. Please review our reservation policy:</p>

        <ul className="list-disc pl-4 text-xs space-y-1.5">
          <li>We allow a 10-minute grace period for late arrivals. After this period, your table may be given to waiting guests</li>
          <li>Reservations can be made online, via phone, or in person</li>
          <li>If you need to cancel or reschedule, please do so at least 24 hours in advance</li>
          <li>We strive to accommodate seating preferences (e.g., outdoor, window, booth seating), but they are not guaranteed</li>
          <li>We respect your privacy and will never sell or share your personal data with third parties.</li>
          <li>Your reservation details (such as name, phone number, and email) are used only for managing your booking and providing important updates.</li>
          <li>We may occasionally use your email to send exclusive offers, event invitations, or special promotions, but you can opt out anytime by clicking the unsubscribe link in our emails.</li>

        </ul>

        <p className="mt-4 text-xs text-gray-500">
          For any questions about our policy, please contact us directly at thaiphoonpaloalto@gmail.com.
        </p>
      </PolicyModal>
    </div>
  );
};

export default Confirmation;