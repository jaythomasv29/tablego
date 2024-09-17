"use client"
import React, { useState, useEffect } from 'react';

export function GreetingClock() {
    const [time, setTime] = useState<string | null>(null);

    useEffect(() => {
        // Set the initial time
        setTime(new Date().toLocaleTimeString());

        // Update time every second
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString());
        }, 1000);

        // Clear interval on unmount
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="bg-white rounded-lg shadow-md p-4 h-full flex flex-col justify-center items-center">
            <h2 className="text-2xl font-semibold mb-2">Hi There!</h2>
            {time !== null ? <p className="text-lg">{time}</p> : <p className="text-lg">Loading...</p>}
        </div>
    );
}