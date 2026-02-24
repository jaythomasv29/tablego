import React from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { TimeSlot } from '@/types/TimeSlot';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import { ThemeProvider, createTheme } from '@mui/material/styles';

interface DatePickerProps {
  date: Date;
  time: string;
  onUpdate: (date: Date, time: string) => void;
  onDateChange: (date: Date) => void;
  availableTimeSlots: TimeSlot[];
  specialDates: SpecialDate[];
}

interface SpecialDate {
  date: string;
  reason: string;
  closureType?: 'full' | 'lunch' | 'dinner';
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#A3B18A',
    },
  },
});

const isSameMonthAndDay = (date1: Date, date2: Date): boolean => {
  return date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

const getClosureType = (specialDate?: SpecialDate): 'full' | 'lunch' | 'dinner' | null => {
  if (!specialDate) return null;
  return specialDate.closureType || 'full';
};

const DatePicker: React.FC<DatePickerProps> = ({
  date,
  time,
  onUpdate,
  onDateChange,
  availableTimeSlots = [],
  specialDates = []
}) => {
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if date is in the past
    if (date < today) return true;

    // Disable only full-day closures. Half-day closures can still accept reservations.
    return specialDates.some(specialDate => {
      const holidayDate = new Date(specialDate.date);
      return isSameMonthAndDay(date, holidayDate) && getClosureType(specialDate) === 'full';
    });
  };

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
            <ThemeProvider theme={theme}>
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <MuiDatePicker
                  value={date}
                  onChange={(newDate) => {
                    if (newDate) {
                      newDate.setHours(12, 0, 0, 0);
                      onUpdate(newDate, time);
                      onDateChange(newDate);
                    }
                  }}
                  shouldDisableDate={isDateDisabled}
                  sx={{
                    width: '100%',
                    '& .MuiOutlinedInput-root': {
                      '&:hover fieldset': {
                        borderColor: '#A3B18A',
                      },
                      '& fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      },
                      '&.Mui-error fieldset': {
                        borderColor: 'rgba(0, 0, 0, 0.23)',
                      }
                    },
                  }}
                />
              </LocalizationProvider>
            </ThemeProvider>
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
                        ? 'bg-[#A3B18A] text-zinc-900'
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
                        ? 'bg-[#A3B18A] text-zinc-900'
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
      {availableTimeSlots.length === 0 && (
        <p className="text-red-500 text-sm mt-2">
          No time slots available for this date. Please select another date.
        </p>
      )}
    </div>
  );
};

export default DatePicker;