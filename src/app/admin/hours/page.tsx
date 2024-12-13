'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

interface BusinessHours {
    [key: string]: {
        lunch: {
            open: string;
            close: string;
            isOpen: boolean;
        };
        dinner: {
            open: string;
            close: string;
            isOpen: boolean;
        };
    };
}

const defaultHours: BusinessHours = {
    monday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '22:00', isOpen: true }
    },
    tuesday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '22:00', isOpen: true }
    },
    wednesday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '22:00', isOpen: true }
    },
    thursday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '22:00', isOpen: true }
    },
    friday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '23:00', isOpen: true }
    },
    saturday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '23:00', isOpen: true }
    },
    sunday: {
        lunch: { open: '11:00', close: '15:00', isOpen: true },
        dinner: { open: '17:00', close: '22:00', isOpen: true }
    },
};

export default function BusinessHoursAdmin() {
    const [hours, setHours] = useState<BusinessHours>(defaultHours);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        loadBusinessHours();
    }, []);

    const loadBusinessHours = async () => {
        try {
            const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
            if (hoursDoc.exists()) {
                const data = hoursDoc.data() as BusinessHours;
                // Merge with default hours to ensure all properties exist
                const mergedHours = Object.keys(defaultHours).reduce((acc, day) => ({
                    ...acc,
                    [day]: {
                        lunch: { ...defaultHours[day].lunch, ...(data[day]?.lunch || {}) },
                        dinner: { ...defaultHours[day].dinner, ...(data[day]?.dinner || {}) }
                    }
                }), {} as BusinessHours);
                setHours(mergedHours);
            }
        } catch (error) {
            console.error('Error loading business hours:', error);
            alert('Failed to load business hours');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'businessHours'), hours);
            alert('Business hours saved successfully');
            router.push('/admin/home');
        } catch (error) {
            console.error('Error saving business hours:', error);
            alert('Failed to save business hours');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (
        day: string,
        mealType: 'lunch' | 'dinner',
        field: 'open' | 'close' | 'isOpen',
        value: string | boolean
    ) => {
        setHours(prev => ({
            ...prev,
            [day]: {
                ...prev[day],
                [mealType]: {
                    ...prev[day][mealType],
                    [field]: value,
                },
            },
        }));
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <AdminLayout>


            <div className="max-w-4xl mx-auto p-6">
                <Link
                    href="/admin/home"
                    className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
                >
                    <svg
                        className="w-6 h-6 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                    </svg>
                    Back to Dashboard
                </Link>

                <h1 className="text-2xl font-bold mb-6">Business Hours Management</h1>

                <div className="bg-white shadow rounded-lg p-6">
                    {Object.entries(hours).map(([day, mealTimes]) => (
                        <div key={day} className="mb-6 p-4 border rounded">
                            <h2 className="text-lg font-semibold capitalize mb-4">{day}</h2>

                            {/* Lunch Hours */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-md font-medium">Lunch Hours</h3>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={mealTimes.lunch.isOpen}
                                            onChange={(e) => handleChange(day, 'lunch', 'isOpen', e.target.checked)}
                                            className="mr-2"
                                        />
                                        Open for Lunch
                                    </label>
                                </div>

                                {mealTimes.lunch.isOpen && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Opening Time</label>
                                            <input
                                                type="time"
                                                value={mealTimes.lunch.open}
                                                onChange={(e) => handleChange(day, 'lunch', 'open', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Closing Time</label>
                                            <input
                                                type="time"
                                                value={mealTimes.lunch.close}
                                                onChange={(e) => handleChange(day, 'lunch', 'close', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Dinner Hours */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-md font-medium">Dinner Hours</h3>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={mealTimes.dinner.isOpen}
                                            onChange={(e) => handleChange(day, 'dinner', 'isOpen', e.target.checked)}
                                            className="mr-2"
                                        />
                                        Open for Dinner
                                    </label>
                                </div>

                                {mealTimes.dinner.isOpen && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Opening Time</label>
                                            <input
                                                type="time"
                                                value={mealTimes.dinner.open}
                                                onChange={(e) => handleChange(day, 'dinner', 'open', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Closing Time</label>
                                            <input
                                                type="time"
                                                value={mealTimes.dinner.close}
                                                onChange={(e) => handleChange(day, 'dinner', 'close', e.target.value)}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full mt-4 bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
