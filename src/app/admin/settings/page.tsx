'use client';

import AdminLayout from '@/components/AdminLayout';
import { useEffect, useState } from 'react';
import { defaultRestaurant, type RestaurantIdentity } from '@/lib/restaurant/config';
import toast, { Toaster } from 'react-hot-toast';
import { Globe, Save, RefreshCw, Clock, Mail, Send, Trash2, Bell } from 'lucide-react';
import PageTransition from '@/components/PageTransition';
import { TIMEZONE_OPTIONS, useTimezone } from '@/contexts/TimezoneContext';
import {
    SOUND_OPTIONS,
    getSoundPreference,
    setSoundPreference,
    playNotificationSound,
    type SoundType,
} from '@/utils/soundUtils';

export default function AdminSettings() {
    const [selectedTimezone, setSelectedTimezone] = useState<string>('America/Los_Angeles');
    const [reservationCutoffMinutes, setReservationCutoffMinutes] = useState<number>(60); // Default 1 hour
    const [minimumLeadTimeMinutes, setMinimumLeadTimeMinutes] = useState<number>(50);
    const [restaurant, setRestaurant] = useState<RestaurantIdentity>(defaultRestaurant);
    const [autoConfirmReservations, setAutoConfirmReservations] = useState(true);
    const [version, setVersion] = useState(0);
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const staging = process.env.NEXT_PUBLIC_TABLEGO_ENVIRONMENT === 'staging';
    const [sendingTest, setSendingTest] = useState(false);
    const [deletingTest, setDeletingTest] = useState(false);
    const [notificationSound, setNotificationSound] = useState<SoundType>('chime');
    const { refreshTimezone } = useTimezone();

    // Current time display in selected timezone
    const [currentTime, setCurrentTime] = useState<string>('');

    useEffect(() => {
        setNotificationSound(getSoundPreference());
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await fetch('/api/staff/settings', { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Failed to load settings');
                setSelectedTimezone(data.timezone);
                setReservationCutoffMinutes(data.reservationCutoffMinutes);
                setMinimumLeadTimeMinutes(data.minimumLeadTimeMinutes);
                setRestaurant(data.restaurant);
                setAutoConfirmReservations(data.autoConfirmReservations);
                setVersion(data.version);
            } catch (error) {
                console.error('Error fetching settings:', error);
                setLoadError('Failed to load settings. Reload before saving.');
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
            const response = await fetch('/api/staff/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: selectedTimezone, reservationCutoffMinutes, minimumLeadTimeMinutes, restaurant, version, autoConfirmReservations }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to save settings');
            setVersion(result.version);

            // Refresh the global timezone context
            await refreshTimezone();

            toast.success('Settings saved successfully!');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSendTestEmail = async () => {
        if (!testEmail.trim()) return;
        setSendingTest(true);
        try {
            const res = await fetch('/api/send-test-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: testEmail.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Synthetic request saved; test notifications queued for capture.');
                setTestEmail('');
            } else {
                toast.error(data.error || 'Failed to send test email');
            }
        } catch {
            toast.error('Failed to send test email');
        } finally {
            setSendingTest(false);
        }
    };

    const handleDeleteTestReservations = async () => {
        setDeletingTest(true);
        try {
            const res = await fetch('/api/delete-test-reservations', { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast.success(data.deleted === 0
                    ? 'No test reservations found'
                    : `Deleted ${data.deleted} test reservation${data.deleted !== 1 ? 's' : ''}`
                );
            } else {
                toast.error(data.error || 'Failed to delete test reservations');
            }
        } catch {
            toast.error('Failed to delete test reservations');
        } finally {
            setDeletingTest(false);
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
                    <p className="text-gray-600 mt-1">Configure your restaurant&apos;s settings</p>
                </div>

                {loadError && <p role="alert" className="mb-4 rounded-md border border-red-300 p-3 text-red-700">{loadError}</p>}
                <section className="bg-white text-zinc-900 rounded-xl border p-6 mb-6 space-y-4" aria-label="Restaurant identity">
                    <h2 className="text-lg font-semibold">Restaurant identity &amp; public links</h2>
                    <p className="text-sm text-zinc-600">Used across guest pages and reservation messages. Save Settings applies identity, timezone and booking policies together.</p>
                    <div className="grid gap-4 sm:grid-cols-2">{(Object.keys(defaultRestaurant) as (keyof RestaurantIdentity)[]).map(key => <div key={key}>
                        <label htmlFor={`identity-${key}`} className="block text-sm font-medium mb-2">{key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</label>
                        <input id={`identity-${key}`} value={restaurant[key]} maxLength={500} className="w-full rounded-md border bg-white text-zinc-900 p-2" onChange={event => setRestaurant(previous => ({ ...previous, [key]: event.target.value }))} />
                    </div>)}</div>
                </section>
                {/* Timezone Settings Card */}
                <div className="bg-white text-zinc-900 rounded-xl shadow-md p-6 mb-6">
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
                                    Customers will see available time slots based on this timezone, regardless of their browser&apos;s local time.
                                </p>
                            </div>
                        </div>
                    </div>

                    <section aria-label="Reservation confirmation" className="my-6 space-y-3 rounded-lg border p-4 text-zinc-900">
                        <h2 className="text-lg font-semibold">Reservation confirmation</h2>
                        <label className="flex items-start gap-3">
                            <input type="checkbox" className="mt-1" checked={autoConfirmReservations} disabled={saving || Boolean(loadError)} onChange={event => setAutoConfirmReservations(event.target.checked)} />
                            <span><strong>Automatically confirm new reservations</strong><br /><span className="text-sm text-zinc-600">On by default. Eligible submissions and reschedules are confirmed immediately. Turn off to require staff acceptance.</span></span>
                        </label>
                        <p className="text-sm text-zinc-600">This applies to future submissions and changed bookings. Existing requests retain their current status. Customers can still let you know they are coming, reschedule or cancel using their secure link.</p>
                    </section>

                    {/* Save Button */}
                    <button
                        onClick={handleSave}
                        disabled={saving || Boolean(loadError)}
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
                                Save Settings
                            </>
                        )}
                    </button>
                </div>

                {/* Reservation Cutoff Settings Card */}
                <div className="bg-white text-zinc-900 rounded-xl shadow-md p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-orange-50 rounded-full">
                            <Clock className="w-6 h-6 text-orange-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Reservation Cutoff Before Closing</h2>
                            <p className="text-sm text-gray-500">
                                Set how long before closing time customers can no longer make reservations.
                            </p>
                        </div>
                    </div>

                    {/* Cutoff Time Selector */}
                    <div className="mb-6">
                        <label htmlFor="cutoff" className="block text-sm font-medium text-gray-700 mb-2">
                            Cutoff Time (minutes before closing)
                        </label>
                        <select
                            id="cutoff"
                            value={reservationCutoffMinutes}
                            onChange={(e) => setReservationCutoffMinutes(Number(e.target.value))}
                            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-gray-900"
                        >
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={50}>50 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                            <option value={150}>2.5 hours</option>
                            <option value={180}>3 hours</option>
                        </select>
                    </div>

                    {/* Current Setting Display */}
                    <div className="mb-6 p-4 bg-orange-50 rounded-lg border border-orange-200">
                        <p className="text-sm text-orange-800">
                            <strong>Current Setting:</strong> Customers cannot book a reservation within{' '}
                            <strong>{reservationCutoffMinutes >= 60
                                ? `${reservationCutoffMinutes / 60} hour${reservationCutoffMinutes > 60 ? 's' : ''}`
                                : `${reservationCutoffMinutes} minutes`}</strong>{' '}
                            of closing time.
                        </p>
                    </div>

                    {/* Example */}
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600">
                            <strong>Example:</strong> If dinner closes at 9:30 PM and cutoff is set to 1 hour,
                            the last available reservation slot will be 8:30 PM.
                        </p>
                    </div>
                </div>

                {/* Minimum Booking Lead Time Card */}
                <div className="bg-white text-zinc-900 rounded-xl shadow-md p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-purple-50 rounded-full">
                            <Clock className="w-6 h-6 text-purple-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Minimum Booking Lead Time</h2>
                            <p className="text-sm text-gray-500">
                                Minimum time in advance a guest must book a same-day reservation.
                            </p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="leadTime" className="block text-sm font-medium text-gray-700 mb-2">
                            Lead Time (minutes from now)
                        </label>
                        <select
                            id="leadTime"
                            value={minimumLeadTimeMinutes}
                            onChange={(e) => setMinimumLeadTimeMinutes(Number(e.target.value))}
                            className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
                        >
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={50}>50 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                        </select>
                    </div>

                    <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-sm text-purple-800">
                            <strong>Current Setting:</strong> Same-day reservations must be booked at least{' '}
                            <strong>{minimumLeadTimeMinutes >= 60
                                ? `${minimumLeadTimeMinutes / 60} hour${minimumLeadTimeMinutes > 60 ? 's' : ''}`
                                : `${minimumLeadTimeMinutes} minutes`}</strong>{' '}
                            in advance.
                        </p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-sm text-gray-600">
                            <strong>Example:</strong> If a guest tries to book at 6:40 PM with a 60-minute lead time,
                            the earliest eligible slot is at or after 7:40 PM, aligned with the restaurant&apos;s booking intervals.
                        </p>
                    </div>
                </div>

                {/* Test Email Card */}
                <div className="bg-white text-zinc-900 rounded-xl shadow-md p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-green-50 rounded-full">
                            <Mail className="w-6 h-6 text-green-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Send Test Email</h2>
                            <p className="text-sm text-gray-500">
                                Available in isolated staging only. Creates a synthetic booking and queues captured notifications without sending real messages.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-3 flex-wrap">
                        <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendTestEmail()}
                            placeholder="Enter email address"
                            className="flex-1 md:max-w-sm px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400"
                        />
                        <button
                            onClick={handleSendTestEmail}
                            disabled={!staging || sendingTest || !testEmail.trim()}
                            className="flex items-center gap-2 px-5 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {sendingTest ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Send Test
                                </>
                            )}
                        </button>
                        <button
                            onClick={handleDeleteTestReservations}
                            disabled={deletingTest}
                            className="flex items-center gap-2 px-5 py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {deletingTest ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4" />
                                    Delete Test Reservations
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Notification Sound Card */}
                <div className="bg-white text-zinc-900 rounded-xl shadow-md p-6 mb-6">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-50 rounded-full">
                            <Bell className="w-6 h-6 text-indigo-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold">Notification Sound</h2>
                            <p className="text-sm text-gray-500">
                                Choose the sound that plays when a new reservation comes in. Saved to this browser.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mb-5">
                        {SOUND_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    setNotificationSound(option.value);
                                    setSoundPreference(option.value);
                                }}
                                className={`flex-1 flex flex-col items-center gap-1 px-4 py-4 rounded-xl border-2 transition-all ${
                                    notificationSound === option.value
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <span className="font-semibold text-sm">{option.label}</span>
                                <span className="text-xs text-gray-400">{option.description}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={() => playNotificationSound(notificationSound)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm"
                    >
                        <Bell className="w-4 h-4" />
                        Preview Sound
                    </button>
                </div>

                {/* Additional Info */}
                <div className="bg-white text-zinc-900 rounded-xl shadow-md p-6">
                    <h3 className="text-lg font-semibold mb-4">How Timezone Settings Work</h3>
                    <ul className="space-y-3 text-gray-600">
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>All reservation times are stored and displayed in the restaurant&apos;s timezone.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>Customers will see available slots in your restaurant&apos;s timezone, not their local time.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>Business hours are configured based on this timezone setting.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 font-bold">•</span>
                            <span>Email confirmations will show times in the restaurant&apos;s timezone.</span>
                        </li>
                    </ul>
                </div>
            </PageTransition>
        </AdminLayout>
    );
}

