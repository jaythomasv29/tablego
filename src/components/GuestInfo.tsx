import React from 'react';
import { User, Mail, Phone } from 'lucide-react';
import { ReservationData } from '../App';

type Props = {
  formData: ReservationData;
  onUpdate: (data: Partial<ReservationData>) => void;
};

const GuestInfo: React.FC<Props> = ({ formData, onUpdate }) => {
  const formatPhoneNumber = (input: string): string => {
    const digits = input.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length < 4) return `(${digits}`;
    if (digits.length < 7) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
    return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handlePhoneChange = (value: string) => {
    onUpdate({ phone: formatPhoneNumber(value) });
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6 drop-shadow-sm">
        Guest Information
      </h2>

      <div className="space-y-6">
        <div>

        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Full Name</span>
            </div>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            placeholder="John Doe"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <Mail className="w-4 h-4" />
              <span>Email</span>
            </div>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => onUpdate({ email: e.target.value })}
            placeholder="john@example.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <Phone className="w-4 h-4" />
              <span>Phone Number</span>
            </div>
          </label>
          <div className="flex items-center w-full border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 overflow-hidden">
            <span className="px-3 py-2 bg-gray-50 border-r border-gray-300 text-gray-700 text-sm font-medium">
              +1
            </span>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="(123)-456-7890"
              className="w-full px-3 py-2 border-0 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestInfo;