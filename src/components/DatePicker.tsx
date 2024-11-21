import React, { useEffect } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
// import { ReservationData } from './ReservationForm';
// import { TimeSlot } from '@/types/timeslot';

type Props = {
  date: Date;
  time: string;
  onUpdate: (date: Date, time: string) => void;
  onDateChange: (date: Date) => void;
  availableTimeSlots: string[];
};

interface DatePickerProps {
  date: Date;
  time: string;
  onUpdate: (date: Date, time: string) => void;
  onDateChange: (date: Date) => void;
  availableTimeSlots: string[];
}

const DatePicker: React.FC<DatePickerProps> = ({
  date,
  time,
  onUpdate,
  onDateChange,
  availableTimeSlots = []
}: DatePickerProps) => {

  // Set tomorrow as default date on component mount
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
    onUpdate(tomorrow, time);
    onDateChange(tomorrow);
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">
          Select Date & Time
        </h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="w-4 h-4" />
                <span>Date</span>
              </div>
            </label>
            <input
              type="date"
              value={date.toISOString().split('T')[0]}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-').map(Number);
                const newDate = new Date(year, month - 1, day, 12, 0, 0);
                onUpdate(newDate, time);
                onDateChange(newDate);
              }}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Time Slots</h3>

            <div className="mb-6">
              <h4 className="text-lg font-medium text-gray-800 mb-3">Lunch Hours</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {availableTimeSlots
                  .filter(slot => slot.period === 'lunch')
                  .map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => onUpdate(date, slot.time)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${time === slot.time
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {slot.time}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-800 mb-3">Dinner Hours</h4>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {availableTimeSlots
                  .filter(slot => slot.period === 'dinner')
                  .map((slot) => (
                    <button
                      key={slot.time}
                      onClick={() => onUpdate(date, slot.time)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium ${time === slot.time
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                    >
                      {slot.time}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatePicker;