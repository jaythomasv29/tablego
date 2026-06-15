'use client';

import React from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
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
    const d = new Date(selected);
    d.setHours(12, 0, 0, 0);
    onUpdate(d, time);
    onDateChange(d);
  };

  const lunchSlots = availableTimeSlots.filter((s) => s.period === 'lunch');
  const dinnerSlots = availableTimeSlots.filter((s) => s.period === 'dinner');

  const specialDateForSelectedDay = specialDates.find((sd) =>
    isSameMonthAndDay(date, new Date(sd.date))
  );
  const partialClosure =
    specialDateForSelectedDay?.closureType === 'lunch' ||
    specialDateForSelectedDay?.closureType === 'dinner'
      ? specialDateForSelectedDay
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Select Date &amp; Time
        </h2>

        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden w-full">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDaySelect}
            disabled={isDateDisabled}
            fromDate={today}
            className="w-full"
            classNames={{
              months: 'w-full relative flex flex-col gap-4',
              month: 'w-full flex flex-col gap-4',
              table: 'w-full border-collapse',
              month_caption: 'flex h-auto w-full items-center justify-center px-7 py-3 border-b border-gray-100',
              caption_label: 'text-base font-semibold text-gray-900',
              weekdays: 'flex w-full',
              weekday: 'flex-1 text-center text-xs font-medium text-gray-500 py-2 select-none',
              week: 'flex w-full mt-1',
              day: 'relative flex-1 p-0 text-center',
              today: '',
              disabled: '',
              outside: '',
            }}
            components={{
              DayButton: ({ day, modifiers, children, ...buttonProps }) => {
                const dayDate = day?.date;
                const isSelected =
                  !!dayDate &&
                  dayDate.getFullYear() === date.getFullYear() &&
                  dayDate.getMonth() === date.getMonth() &&
                  dayDate.getDate() === date.getDate();

                let cls =
                  'flex h-10 w-full items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none';

                if (isSelected) {
                  cls += ' bg-[#A3B18A] text-zinc-900 hover:bg-[#A3B18A]';
                } else if (modifiers?.disabled) {
                  cls += ' text-gray-400 line-through pointer-events-none select-none';
                } else if (modifiers?.outside) {
                  cls += ' text-gray-300 opacity-40 hover:bg-gray-50';
                } else if (modifiers?.today) {
                  cls += ' border border-[#A3B18A] text-zinc-900 hover:bg-gray-50';
                } else {
                  cls += ' text-gray-900 hover:bg-gray-100';
                }

                return (
                  <button {...buttonProps} className={cls}>
                    {children}
                  </button>
                );
              },
            }}
          />
        </div>
      </div>

      {/* Partial closure notice */}
      {partialClosure && (
        <Badge
          variant="outline"
          className="h-auto w-full items-start justify-start gap-2 whitespace-normal rounded-lg border-[#A3B18A]/40 bg-[#A3B18A]/10 px-3 py-2.5 text-left text-sm font-normal text-zinc-700"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#A3B18A]" />
          <span>
            {partialClosure.closureType === 'lunch' ? 'Lunch service' : 'Dinner service'}{' '}
            is unavailable on this date
            {partialClosure.reason ? ` (${partialClosure.reason})` : ''}. We&apos;d love to
            have you for {partialClosure.closureType === 'lunch' ? 'dinner' : 'lunch'} instead!
          </span>
        </Badge>
      )}

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
