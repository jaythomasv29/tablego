import React from 'react';
import { Chip, Typography } from '@mui/material';
import { green, red } from '@mui/material/colors';

interface BusinessHours {
  lunchOpen: number;
  lunchClose: number;
  dinnerOpen: number;
  dinnerCloseRegular: number;
  dinnerCloseWeekend: number;
}

interface BusinessHoursPillProps {
  businessHours: BusinessHours;
}

export function BusinessHoursPill({ businessHours }: BusinessHoursPillProps) {
  const isOpen = React.useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour + currentMinute / 60;

    const isWeekend = currentDay === 5 || currentDay === 6; // Friday or Saturday
    const dinnerCloseTime = isWeekend ? businessHours.dinnerCloseWeekend : businessHours.dinnerCloseRegular;

    const isLunchTime = currentTime >= businessHours.lunchOpen && currentTime < businessHours.lunchClose;
    const isDinnerTime = currentTime >= businessHours.dinnerOpen && currentTime < dinnerCloseTime;

    return isLunchTime || isDinnerTime;
  }, [businessHours]);

  return (
    <div className="flex flex-row items-center">
      <Typography
        sx={{
          fontWeight: 'light',
          fontSize: '0.875rem', // Adjust this value to match the Chip text size
          marginRight: '8px',   // Add some space between the text and the Chip
          color: 'text.primary' // Use the primary text color from your theme
        }}
      >
        The woks are currently:
      </Typography>
      <Chip
        label={isOpen ? "On" : "Off"}
        color={isOpen ? "success" : "error"}
        sx={{
          backgroundColor: isOpen ? green[500] : red[500],
          color: 'white',
          fontWeight: 'bold',
        }}
      />
    </div>
  );
}