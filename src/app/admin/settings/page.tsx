"use client";

import AdminLayout from "@/components/AdminLayout";
import Link from "next/link";
import { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/firebase";
import toast, { Toaster } from "react-hot-toast";
import {
  Globe,
  Save,
  RefreshCw,
  Clock,
  Mail,
  Send,
  Trash2,
  Bell,
  CalendarClock,
  ExternalLink,
  MessageSquareHeart,
  Link2,
} from "lucide-react";
import PageTransition from "@/components/PageTransition";
import { TIMEZONE_OPTIONS, useTimezone } from "@/contexts/TimezoneContext";
import {
  SOUND_OPTIONS,
  getSoundPreference,
  setSoundPreference,
  playNotificationSound,
  type SoundType,
} from "@/utils/soundUtils";

export default function AdminSettings() {
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    "America/Los_Angeles",
  );
  const [reservationCutoffMinutes, setReservationCutoffMinutes] =
    useState<number>(60); // Default 1 hour
  const [minimumLeadTimeMinutes, setMinimumLeadTimeMinutes] =
    useState<number>(50);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [deletingTest, setDeletingTest] = useState(false);
  const [testReservationId, setTestReservationId] = useState<string | null>(
    null,
  );
  const [notificationSound, setNotificationSound] =
    useState<SoundType>("chime");
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState<number>(90);
  const [reviewUrl, setReviewUrl] = useState("");
  const [testFollowUpEmail, setTestFollowUpEmail] = useState("");
  const [sendingTestFollowUp, setSendingTestFollowUp] = useState(false);
  const [testFollowUpReservationId, setTestFollowUpReservationId] = useState<
    string | null
  >(null);
  const { refreshTimezone } = useTimezone();

  // Current time display in selected timezone
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    setNotificationSound(getSoundPreference());
    const storedTestId = localStorage.getItem("admin-test-reservation-id");
    if (storedTestId) setTestReservationId(storedTestId);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          if (data.timezone) {
            setSelectedTimezone(data.timezone);
          }
          if (data.reservationCutoffMinutes !== undefined) {
            setReservationCutoffMinutes(data.reservationCutoffMinutes);
          }
          if (data.minimumLeadTimeMinutes !== undefined) {
            setMinimumLeadTimeMinutes(data.minimumLeadTimeMinutes);
          }
          if (data.followUpDelayMinutes !== undefined) {
            setFollowUpDelayMinutes(data.followUpDelayMinutes);
          }
          if (data.reviewUrl !== undefined) {
            setReviewUrl(data.reviewUrl);
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("Failed to load settings");
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
      const timeString = now.toLocaleTimeString("en-US", {
        timeZone: selectedTimezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateString = now.toLocaleDateString("en-US", {
        timeZone: selectedTimezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
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
      await setDoc(
        doc(db, "settings", "general"),
        {
          timezone: selectedTimezone,
          reservationCutoffMinutes: reservationCutoffMinutes,
          minimumLeadTimeMinutes: minimumLeadTimeMinutes,
          followUpDelayMinutes: followUpDelayMinutes,
          reviewUrl: reviewUrl.trim(),
          updatedAt: new Date(),
        },
        { merge: true },
      );

      // Refresh the global timezone context
      await refreshTimezone();

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    try {
      const res = await fetch("/api/send-test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Test email sent to ${testEmail}`);
        setTestEmail("");
        setTestReservationId(data.reservationId || null);
        if (data.reservationId) {
          localStorage.setItem("admin-test-reservation-id", data.reservationId);
        } else {
          localStorage.removeItem("admin-test-reservation-id");
        }
      } else {
        toast.error(data.error || "Failed to send test email");
      }
    } catch {
      toast.error("Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendTestFollowUp = async () => {
    if (!testFollowUpEmail.trim()) return;
    setSendingTestFollowUp(true);
    try {
      const res = await fetch("/api/send-test-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testFollowUpEmail.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Test follow-up sent to ${testFollowUpEmail}`);
        setTestFollowUpEmail("");
        setTestFollowUpReservationId(data.reservationId || null);
      } else {
        toast.error(data.error || "Failed to send test follow-up");
      }
    } catch {
      toast.error("Failed to send test follow-up");
    } finally {
      setSendingTestFollowUp(false);
    }
  };

  const handleDeleteTestReservations = async () => {
    setDeletingTest(true);
    try {
      const res = await fetch("/api/delete-test-reservations", {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.deleted === 0
            ? "No test reservations found"
            : `Deleted ${data.deleted} test reservation${data.deleted !== 1 ? "s" : ""}`,
        );
        setTestReservationId(null);
        localStorage.removeItem("admin-test-reservation-id");
      } else {
        toast.error(data.error || "Failed to delete test reservations");
      }
    } catch {
      toast.error("Failed to delete test reservations");
    } finally {
      setDeletingTest(false);
    }
  };

  const getTimezoneLabel = (value: string) => {
    const option = TIMEZONE_OPTIONS.find((opt) => opt.value === value);
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
              background: "#363636",
              color: "#fff",
              zIndex: 9999,
            },
          }}
        />

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">
            Configure your restaurant's settings
          </p>
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
                Set the timezone for your restaurant. All reservations will be
                displayed and managed in this timezone.
              </p>
            </div>
          </div>

          {/* Current Time Display */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">
              Current time in {getTimezoneLabel(selectedTimezone)}:
            </p>
            <p className="text-lg font-medium text-gray-900">{currentTime}</p>
          </div>

          {/* Timezone Selector */}
          <div className="mb-6">
            <label
              htmlFor="timezone"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
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
                <svg
                  className="h-5 w-5 text-amber-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-amber-700">
                  <strong>Important:</strong> Changing the timezone will affect
                  how all times are displayed throughout the reservation system.
                  Customers will see available time slots based on this
                  timezone, regardless of their browser's local time.
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
                Save Settings
              </>
            )}
          </button>
        </div>

        {/* Reservation Cutoff Settings Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-orange-50 rounded-full">
              <Clock className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Reservation Cutoff Before Closing
              </h2>
              <p className="text-sm text-gray-500">
                Set how long before closing time customers can no longer make
                reservations.
              </p>
            </div>
          </div>

          {/* Cutoff Time Selector */}
          <div className="mb-6">
            <label
              htmlFor="cutoff"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Cutoff Time (minutes before closing)
            </label>
            <select
              id="cutoff"
              value={reservationCutoffMinutes}
              onChange={(e) =>
                setReservationCutoffMinutes(Number(e.target.value))
              }
              className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white text-gray-900"
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
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
              <strong>Current Setting:</strong> Customers cannot book a
              reservation within{" "}
              <strong>
                {reservationCutoffMinutes >= 60
                  ? `${reservationCutoffMinutes / 60} hour${reservationCutoffMinutes > 60 ? "s" : ""}`
                  : `${reservationCutoffMinutes} minutes`}
              </strong>{" "}
              of closing time.
            </p>
          </div>

          {/* Example */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Example:</strong> If dinner closes at 9:30 PM and cutoff
              is set to 1 hour, the last available reservation slot will be 8:30
              PM.
            </p>
          </div>
        </div>

        {/* Minimum Booking Lead Time Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-50 rounded-full">
              <Clock className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                Minimum Booking Lead Time
              </h2>
              <p className="text-sm text-gray-500">
                Minimum time in advance a guest must book a same-day
                reservation.
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="leadTime"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Lead Time (minutes from now)
            </label>
            <select
              id="leadTime"
              value={minimumLeadTimeMinutes}
              onChange={(e) =>
                setMinimumLeadTimeMinutes(Number(e.target.value))
              }
              className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
            >
              <option className="text-gray-700" value={30}>
                30 minutes
              </option>
              <option value={45}>45 minutes</option>
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
            </select>
          </div>

          <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-800">
              <strong>Current Setting:</strong> Same-day reservations must be
              booked at least{" "}
              <strong>
                {minimumLeadTimeMinutes >= 60
                  ? `${minimumLeadTimeMinutes / 60} hour${minimumLeadTimeMinutes > 60 ? "s" : ""}`
                  : `${minimumLeadTimeMinutes} minutes`}
              </strong>{" "}
              in advance.
            </p>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Example:</strong> If a guest tries to book at 6:40 PM with
              a 60-minute lead time, the earliest available slot they'll see is
              7:40 PM.
            </p>
          </div>
        </div>

        {/* Post-Visit Follow-Up Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-rose-50 rounded-full">
              <MessageSquareHeart className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Post-Visit Follow-Up</h2>
              <p className="text-sm text-gray-500">
                Email guests after their visit to ask how it went, and route
                negative feedback to your team instead of public review
                sites. Sent manually from{" "}
                <Link href="/admin/follow-ups" className="underline">
                  Follow-Ups
                </Link>
                .
              </p>
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="followUpDelay"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Mark follow-ups as &quot;ready to send&quot; this long after the
              reservation time
            </label>
            <select
              id="followUpDelay"
              value={followUpDelayMinutes}
              onChange={(e) => setFollowUpDelayMinutes(Number(e.target.value))}
              className="w-full md:w-96 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white text-gray-900"
            >
              <option value={60}>1 hour</option>
              <option value={90}>1.5 hours</option>
              <option value={120}>2 hours</option>
              <option value={150}>2.5 hours</option>
            </select>
          </div>

          <div className="mb-2">
            <label
              htmlFor="reviewUrl"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Review link (Google / Yelp)
            </label>
            <div className="relative w-full md:w-96">
              <Link2 className="w-4 h-4 text-gray-700 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="reviewUrl"
                type="url"
                value={reviewUrl}
                onChange={(e) => setReviewUrl(e.target.value)}
                placeholder="https://g.page/r/..."
                className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white text-gray-900 placeholder-gray-400"
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Guests who say they loved their visit are sent here. Guests who
              say it could&apos;ve been better are sent to a private feedback
              form instead.
            </p>
          </div>
        </div>

        {/* Test Follow-Up Email Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-rose-50 rounded-full">
              <Send className="w-6 h-6 text-rose-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Send Test Follow-Up</h2>
              <p className="text-sm text-gray-500">
                Creates a real test reservation already past the follow-up delay
                and sends the follow-up email with working &quot;Loved it&quot;,
                &quot;Could&apos;ve been better&quot;, and &quot;Couldn&apos;t
                make it&quot; links.
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={testFollowUpEmail}
              onChange={(e) => setTestFollowUpEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendTestFollowUp()}
              placeholder="Enter email address"
              className="flex-1 md:max-w-sm px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 bg-white text-gray-900 placeholder-gray-400"
            />
            <button
              onClick={handleSendTestFollowUp}
              disabled={sendingTestFollowUp || !testFollowUpEmail.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {sendingTestFollowUp ? (
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
          </div>

          {testFollowUpReservationId && (
            <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-lg">
              <p className="text-sm text-rose-800">
                Test email sent — open it and click a button to try the flow.
                The test reservation (#{testFollowUpReservationId.slice(0, 8)})
                will show up under{" "}
                <Link href="/admin/follow-ups" className="underline">
                  Follow-Ups → Needs Review
                </Link>{" "}
                until you respond.
              </p>
            </div>
          )}
        </div>

        {/* Test Email Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-green-50 rounded-full">
              <Mail className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Send Test Email</h2>
              <p className="text-sm text-gray-500">
                Creates a real test reservation in Firebase and sends both the
                customer and restaurant confirmation emails — with working
                cancel, reschedule, and menu download links.
              </p>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendTestEmail()}
              placeholder="Enter email address"
              className="flex-1 md:max-w-sm px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white text-gray-900 placeholder-gray-400"
            />
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest || !testEmail.trim()}
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

          {testReservationId && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  <span>
                    Test reservation ready — try the reschedule flow exactly as
                    a guest would.
                  </span>
                </div>
                <a
                  href={`/reschedule/${testReservationId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  Test Reschedule Page
                </a>
              </div>
              <p className="mt-2 text-xs text-blue-700/80">
                This link always points to the same test reservation (#
                {testReservationId.slice(0, 8)}), so reopening it after
                rescheduling will show the updated date/time. Clicking
                &quot;Send Test&quot; again creates a brand-new test reservation
                reset to the original date.
              </p>
            </div>
          )}
        </div>

        {/* Notification Sound Card */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 rounded-full">
              <Bell className="w-6 h-6 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Notification Sound</h2>
              <p className="text-sm text-gray-500">
                Choose the sound that plays when a new reservation comes in.
                Saved to this browser.
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
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span className="font-semibold text-sm">{option.label}</span>
                <span className="text-xs text-gray-700">
                  {option.description}
                </span>
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
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">
            How Timezone Settings Work
          </h3>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                All reservation times are stored and displayed in the
                restaurant's timezone.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                Customers will see available slots in your restaurant's
                timezone, not their local time.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                Business hours are configured based on this timezone setting.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-bold">•</span>
              <span>
                Email confirmations will show times in the restaurant's
                timezone.
              </span>
            </li>
          </ul>
        </div>
      </PageTransition>
    </AdminLayout>
  );
}
