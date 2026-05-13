'use client';

import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { TimeSlot } from '@/types/TimeSlot';

interface SpecialDate {
  date: string;
  reason: string;
  closureType?: 'full' | 'lunch' | 'dinner';
}

interface DatePickerProps {
  date: Date;
  time: string;
  onUpdate: (date: Date, time: string) => void;
  onDateChange: (date: Date) => void;
  availableTimeSlots: TimeSlot[];
  specialDates: SpecialDate[];
}

const isSameMonthAndDay = (d1: Date, d2: Date) =>
  d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

const DatePickerComponent: React.FC<DatePickerProps> = ({
  date,
  time,
  onUpdate,
  onDateChange,
  availableTimeSlots = [],
  specialDates = [],
}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isDateDisabled = (d: Date) => {
    if (d < today) return true;
    return specialDates.some(
      (sd) =>
        isSameMonthAndDay(d, new Date(sd.date)) &&
        (sd.closureType ?? 'full') === 'full'
    );
  };

  const handleDaySelect = (selected: Date | undefined) => {
    if (!selected) return;
    selected.setHours(12, 0, 0, 0);
    onUpdate(selected, time);
    onDateChange(selected);
  };

  const lunchSlots = availableTimeSlots.filter((s) => s.period === 'lunch');
  const dinnerSlots = availableTimeSlots.filter((s) => s.period === 'dinner');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Select Date &amp; Time
        </h2>

        {/* Calendar */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden w-full">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDaySelect}
            disabled={isDateDisabled}
            fromDate={today}
            className="w-full [&_.rdp]:w-full [&_.rdp-months]:w-full [&_.rdp-month]:w-full [&_.rdp-table]:w-full [&_.rdp-head_cell]:flex-1 [&_.rdp-cell]:flex-1 [&_.rdp-row]:w-full [&_.rdp-day]:w-full"
            classNames={{
              months: 'w-full',
              month: 'w-full',
              table: 'w-full',
              head_row: 'flex w-full',
              head_cell: 'flex-1 text-center text-xs font-medium text-gray-500 py-2',
              row: 'flex w-full mt-1',
              cell: 'flex-1 text-center p-0',
              day: 'w-full h-10 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors mx-auto flex items-center justify-center',
              day_selected: 'bg-[#A3B18A] text-zinc-900 hover:bg-[#A3B18A] font-semibold',
              day_today: 'border border-[#A3B18A] text-zinc-900',
              day_disabled: 'text-gray-300 line-through cursor-not-allowed hover:bg-transparent',
              day_outside: 'text-gray-300 opacity-40',
              caption: 'flex justify-center items-center relative py-3 px-4 border-b border-gray-100',
              caption_label: 'text-base font-semibold text-gray-900',
              nav_button: 'absolute h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors',
              nav_button_previous: 'left-3',
              nav_button_next: 'right-3',
            }}
          />
        </div>
      </div>

      {/* Time Slots */}
      {availableTimeSlots.length === 0 ? (
        <p className="text-sm text-gray-500 bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
          No time slots available for this date — please select another day.
        </p>
      ) : (
        <div className="space-y-5">
          {lunchSlots.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Lunch
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {lunchSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => onUpdate(date, slot.time)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      time === slot.time
                        ? 'bg-[#A3B18A] text-zinc-900'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {dinnerSlots.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">
                Dinner
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {dinnerSlots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    onClick={() => onUpdate(date, slot.time)}
                    className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                      time === slot.time
                        ? 'bg-[#A3B18A] text-zinc-900'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DatePickerComponent;
