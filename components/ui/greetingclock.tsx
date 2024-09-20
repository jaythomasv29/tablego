import React, { useState, useEffect, ReactNode } from 'react';
import { format } from 'date-fns';
import { Meteors } from './Meteors'; // Adjust the import path as needed
import { cn } from '@/lib/utils';
// import AnimatedGradientText from './AnimatedGradientText'; // Adjust the import path as needed
import SparklesText from "@/components/magicui/sparkles-text";
import { BusinessHoursPill } from './BusinessHoursPill';

export function GreetingClock() {
    const [time, setTime] = useState<string | null>(null);
    const [date, setDate] = useState<string>('');
    const [timezone, setTimezone] = useState<string>('');
    const businessHours = {
        lunchOpen: 11,    // 11:00 AM
        lunchClose: 14.5, // 2:30 PM
        dinnerOpen: 16,   // 4:00 PM
        dinnerCloseRegular: 21,  // 9:00 PM
        dinnerCloseWeekend: 21.5 // 9:30 PM
    };

    useEffect(() => {
        // Set the initial time, date, and timezone
        const updateDateTime = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString());
            setDate(format(now, 'MMMM d, yyyy'));
            setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
        };

        updateDateTime();

        // Update time every second
        const timer = setInterval(updateDateTime, 1000);

        // Clear interval on unmount
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col justify-center items-center relative overflow-hidden">
            <Meteors number={20} />
            <h2 className="text-2xl font-semibold mb-2">Let's Grab Thai 🇹🇭 🍽️</h2>
            {time !== null ? (
                <>
                    <p className="text-lg">{time}</p>
                    <p className="text-md mt-2">{date}</p>
                    {/* <p className="text-sm text-gray-500 mt-1">{timezone}</p> */}
                </>
            ) : (
                <p className="text-lg">Loading...</p>
            )}
            <div className="mt-2">
                <BusinessHoursPill businessHours={businessHours} />
            </div>
        </div>
    );
}

