'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import toast, { Toaster } from 'react-hot-toast';
import { Globe, Save, RefreshCw } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { TIMEZONE_OPTIONS, useTimezone } from '@/contexts/TimezoneContext';

export default function AdminSettings() {
    const [selectedTimezone, setSelectedTimezone] = useState<string>('America/Los_Angeles');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { refreshTimezone } = useTimezone();

    // Current time display in selected timezone
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
                if (settingsDoc.exists()) {
                    const data = settingsDoc.data();
                    if (data.timezone) {
                        setSelectedTimezone(data.timezone);
                    }
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    // Update current time display every second
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                timeZone: selectedTimezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
            });
            const dateString = now.toLocaleDateString('en-US', {
                timeZone: selectedTimezone,
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            });
            setCurrentTime(`${dateString} at ${timeString}`);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, [selectedTimezone]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'general'), {
                timezone: selectedTimezone,
                updatedAt: new Date(),
            }, { merge: true });
            
            // Refresh the global timezone context
            await refreshTimezone();
            
            toast.success('Timezone settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const getTimezoneLabel = (value: string) => {
        const option = TIMEZONE_OPTIONS.find(opt => opt.value === value);
        return option ? option.label : value;
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <PageTransition>
                <Toaster
                    position="top-center"
                    toastOptions={{
                        duration: 3000,
                        style: {
                            background: '#363636',
                            color: '#fff',
                            zIndex: 9999,
                        },
                    }}
                />

                <div className="mb-6">
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <p className="text-gray-600 mt-1">Configure your restaurant's settings</p>
                </div>

                {/* Timezone Settings Card */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-blue-50 rounded-full">
                            <Globe className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Restaurant Timezone</h2>
                            <p className="text-sm text-gray-500">
                                Set the timezone for your restaurant. All reservations will be displayed and managed in this timezone.
                            </p>
                        </div>
                    </div>

                    {/* Current Time Display */}
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600 mb-1">Current time in {getTimezoneLabel(selectedTimezone)}:</p>
                        <p className="text-lg font-medium text-gray-900">{currentTime}</p>
                    </div>

                    {/* Timezone Selector */}
                    <div className="mb-6">
                        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                            Select Timezone
                        </label>
                        <select
                            id="timezone"
                            value={selectedTimezone}
                            onChange={(e) => setSelectedTimezone(e.target.value)}
                            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900"
                        >
                            {TIMEZONE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label} ({option.value})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Info Box */}
                    <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-amber-700">
                                    <strong>Important:</strong> Changing the timezone will affect how all times are displayed throughout the reservation system. 
                                    Customers will see available time slots based on this timezone, regardless of their browser's local time.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5" />
                                Save Timezone Settings
                            </>
                        )}
                    </button>
                </div>

                {/* Additional Info */}
                <div className="bg-white rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">How Timezone Settings Work</h3>
                    <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>All reservation times are stored and displayed in the restaurant's timezone.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>Customers will see available slots in your restaurant's timezone, not their local time.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>Business hours are configured based on this timezone setting.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>Email confirmations will show times in the restaurant's timezone.</span>
                        </li>
                    </ul>
                </div>
            </PageTransition>
        </AdminLayout>
    );
}

