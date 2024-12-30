import React from 'react';
import { User, Mail, Phone, Users } from 'lucide-react';
import { ReservationData } from '../App';

type Props = {
  formData: ReservationData;
  onUpdate: (data: Partial<ReservationData>) => void;
};

const GuestInfo: React.FC<Props> = ({ formData, onUpdate }) => {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Guest Information
      </h2>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4" />
              <span>Number of Guests</span>
            </div>
          </label>
          <select
            value={formData.guests}
            onChange={(e) => onUpdate({ guests: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? 'Guest' : 'Guests'}
              </option>
            ))}
          </select>
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
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => onUpdate({ phone: e.target.value })}
            placeholder="+1 (555) 000-0000"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};

export default GuestInfo;