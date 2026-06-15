"use client";

import AdminLayout from "@/components/AdminLayout";
import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  getDoc,
  query,
  orderBy,
  limit,
  where,
  updateDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowRightCircle,
  X,
  Calendar,
  Users,
  Clock,
  CalendarDays,
  TrendingUp,
  Utensils,
  Bell,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  User,
  ChefHat,
  Download,
} from "lucide-react";
import PageTransition from "@/components/PageTransition";
import StaggeredList from "@/components/StaggeredList";
import { Timestamp } from "firebase/firestore";
import {
  formatReadableDatePST,
  getLocalDateString,
  getReservationDateTime,
  formatTimeInTimezone,
} from "@/utils/dateUtils";
import { playNotificationSound, unlockAudio } from "@/utils/soundUtils";
import { Reservation } from "../reservation/page";
import Link from "next/link";
import { useTimezone, TIMEZONE_OPTIONS } from "@/contexts/TimezoneContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Business Hours interface
interface DayHours {
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
}

interface BusinessHours {
  [key: string]: DayHours;
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

interface DashboardMetrics {
  totalReservations: number;
  uniqueCustomers: number;
  todayReservations: number;
  totalCatering: number;
  newCatering: number;
  menuDownloads: number;
}

// interface Reservation {
// id: string;
// date: Date;
// time: string;
// name: string;
// guests: number;
// phone: string;
// email: string;
// status: string;
// comments?: string;
// createdAt?: string;
// reminderSent?: boolean;
// reminderSentAt?: Timestamp;
// marked?: boolean;
// }

interface PendingReservation {
  id: string;
  name: string;
  date: Date;
  time: string;
  guests: number;
  phone: string;
  email: string;
  status: string;
  phoneVerified?: boolean;
}

interface MobileNotificationProps {
  count: number;
  onClose: () => void;
}

interface Message {
  id: string;
  name: string;
  email: string;
  message: string;
  timestamp: Date;
  status: "read" | "unread";
}

function MobileNotification({ count, onClose }: MobileNotificationProps) {
  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 md:hidden">
      <Alert className="bg-card border-border shadow-lg">
        <AlertDescription className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-foreground">
              You have {count} pending{""}
              {count === 1 ? "reservation" : "reservations"} that{""}
              {count === 1 ? "needs" : "need"} confirmation
            </p>
            <Button
              variant="link"
              size="sm"
              className="mt-1 h-auto p-0 text-sm font-medium text-muted-foreground hover:text-foreground"
              onClick={() => {
                const element = document.getElementById("pending-reservations");
                element?.scrollIntoView({ behavior: "smooth" });
                onClose();
              }}
            >
              View Reservations →
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// Add this helper function after the imports
const formatTimeAgo = (date: Date) => {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }
  if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  const days = Math.floor(diffInHours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
};

// Short format for reminder sent time
const formatReminderTime = (date: Date) => {
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const minutes = Math.floor(diffInHours * 60);
    return `${minutes}m ago`;
  }
  if (diffInHours < 24) {
    const hours = Math.floor(diffInHours);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffInHours / 24);
  return `${days}d ago`;
};

const formatReservationCreatedAt = (value: any) => {
  if (!value) return "N/A";
  try {
    if (typeof value === "object" && value?.toDate) {
      return value.toDate().toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "N/A";
  }
};

const convertTimeToMinutes = (time: string): number => {
  const [rawTime, period] = time.split("");
  let [hours, minutes] = rawTime.split(":").map(Number);

  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
};

// Add this helper function
const isReservationPassed = (reservationTime: string): boolean => {
  const [time, period] = reservationTime.split("");
  const [hours, minutes] = time.split(":").map(Number);
  const now = new Date();

  let compareHours = hours;
  if (period === "PM" && hours !== 12) compareHours += 12;
  if (period === "AM" && hours === 12) compareHours = 0;

  const reservationDate = new Date();
  reservationDate.setHours(compareHours, minutes);

  return now > reservationDate;
};

// Check if reminder can be sent (not within 24 hours of last reminder)
const canSendReminder = (reservation: Reservation) => {
  if (!reservation.reminderSent) return true;
  if (!reservation.reminderSentAt) return true;

  const lastSent = reservation.reminderSentAt.toDate();
  const hoursSinceLastReminder =
    (Date.now() - lastSent.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastReminder >= 24;
};

// Compute the follow-up email chip label for a reservation, or null if N/A
const getFollowUpChipLabel = (
  reservation: Reservation,
  timezone: string,
  followUpSettings: { delayMinutes: number },
): string | null => {
  if (reservation.status?.toLowerCase() === "cancelled") return null;
  if (reservation.followUpSent) return "Follow-up sent";

  const dateStr = getLocalDateString(reservation.date, timezone);
  const reservationTime = getReservationDateTime(
    dateStr,
    reservation.time,
    timezone,
  );
  const dueAt = new Date(
    reservationTime.getTime() + followUpSettings.delayMinutes * 60 * 1000,
  );

  if (new Date() >= dueAt) return "Follow-up ready to send";

  return `Follow-up ready @ ${formatTimeInTimezone(dueAt, timezone)}`;
};

export default function AdminHome() {
  const { timezone } = useTimezone();
  const [totalViews, setTotalViews] = useState<number>(0);
  const [dailyViews, setDailyViews] = useState<
    { date: string; views: number }[]
  >([]);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalReservations: 0,
    uniqueCustomers: 0,
    todayReservations: 0,
    totalCatering: 0,
    newCatering: 0,
    menuDownloads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [todaysReservations, setTodaysReservations] = useState<Reservation[]>(
    [],
  );
  const [pendingReservations, setPendingReservations] = useState<Reservation[]>(
    [],
  );
  const [isConfirming, setIsConfirming] = useState<string>("");
  const [showMobileNotification, setShowMobileNotification] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "messages">(
    "dashboard",
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMarkingRead, setIsMarkingRead] = useState<string>("");
  const [todayReservations, setTodayReservations] = useState<Reservation[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(
    null,
  );
  const [currentTimeDisplay, setCurrentTimeDisplay] = useState<string>("");
  const [currentDateDisplay, setCurrentDateDisplay] = useState<string>("");
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);
  const [followUpSettings, setFollowUpSettings] = useState<{
    delayMinutes: number;
  }>({ delayMinutes: 90 });

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const response = await fetch("/api/analytics");
        const data = await response.json();

        setTotalViews(data.pageViews?.value || 0);
        setDailyViews(data.dailyViews || []);
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, []);

  // Fetch business hours
  useEffect(() => {
    const fetchBusinessHours = async () => {
      try {
        const hoursDoc = await getDoc(doc(db, "settings", "businessHours"));
        if (hoursDoc.exists()) {
          setBusinessHours(hoursDoc.data() as BusinessHours);
        }
      } catch (error) {
        console.error("Error fetching business hours:", error);
      }
    };

    fetchBusinessHours();
  }, []);

  // Fetch follow-up settings
  useEffect(() => {
    const fetchFollowUpSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "general"));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data();
          setFollowUpSettings({
            delayMinutes: data.followUpDelayMinutes ?? 90,
          });
        }
      } catch (error) {
        console.error("Error fetching follow-up settings:", error);
      }
    };

    fetchFollowUpSettings();
  }, []);

  // Update current time display every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      const dateString = now.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setCurrentTimeDisplay(timeString);
      setCurrentDateDisplay(dateString);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Helper function to get timezone label
  const getTimezoneLabel = (value: string) => {
    const option = TIMEZONE_OPTIONS.find((opt) => opt.value === value);
    return option ? option.label : value;
  };

  // Helper function to check if restaurant is currently open
  const getBusinessStatus = () => {
    if (!businessHours)
      return {
        isOpen: false,
        currentPeriod: null,
        closingTime: null,
        todayHours: null,
      };

    const now = new Date();
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];

    // Get the current day in the restaurant's timezone
    const restaurantNow = new Date(
      now.toLocaleString("en-US", { timeZone: timezone }),
    );
    const currentDay = days[restaurantNow.getDay()];
    const todayHours = businessHours[currentDay];

    if (!todayHours)
      return {
        isOpen: false,
        currentPeriod: null,
        closingTime: null,
        todayHours: null,
      };

    const currentMinutes =
      restaurantNow.getHours() * 60 + restaurantNow.getMinutes();

    // Helper to convert time string to minutes
    const timeToMinutes = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };

    // Helper to format time for display
    const formatTime = (timeStr: string): string => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const period = hours >= 12 ? "PM" : "AM";
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
    };

    // Check lunch hours
    if (todayHours.lunch?.isOpen) {
      const lunchOpen = timeToMinutes(todayHours.lunch.open);
      const lunchClose = timeToMinutes(todayHours.lunch.close);

      if (currentMinutes >= lunchOpen && currentMinutes < lunchClose) {
        return {
          isOpen: true,
          currentPeriod: "Lunch",
          closingTime: formatTime(todayHours.lunch.close),
          todayHours,
        };
      }
    }

    // Check dinner hours
    if (todayHours.dinner?.isOpen) {
      const dinnerOpen = timeToMinutes(todayHours.dinner.open);
      const dinnerClose = timeToMinutes(todayHours.dinner.close);

      if (currentMinutes >= dinnerOpen && currentMinutes < dinnerClose) {
        return {
          isOpen: true,
          currentPeriod: "Dinner",
          closingTime: formatTime(todayHours.dinner.close),
          todayHours,
        };
      }
    }

    return {
      isOpen: false,
      currentPeriod: null,
      closingTime: null,
      todayHours,
    };
  };

  // Helper to format hours for display
  const formatHoursDisplay = (hours: DayHours | null): string[] => {
    if (!hours) return ["Closed"];

    const formatTime = (timeStr: string): string => {
      const [hoursNum, minutes] = timeStr.split(":").map(Number);
      const period = hoursNum >= 12 ? "PM" : "AM";
      const displayHours =
        hoursNum > 12 ? hoursNum - 12 : hoursNum === 0 ? 12 : hoursNum;
      return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
    };

    const parts: string[] = [];
    if (hours.lunch?.isOpen) {
      parts.push(
        `Lunch: ${formatTime(hours.lunch.open)} - ${formatTime(hours.lunch.close)}`,
      );
    }
    if (hours.dinner?.isOpen) {
      parts.push(
        `Dinner: ${formatTime(hours.dinner.open)} - ${formatTime(hours.dinner.close)}`,
      );
    }

    return parts.length > 0 ? parts : ["Closed"];
  };

  const fetchMetrics = async () => {
    try {
      // Get today's date in restaurant's timezone and format as YYYY-MM-DD
      const todayLocal = new Date().toLocaleDateString("en-CA", {
        timeZone: timezone,
      });

      const reservationsRef = collection(db, "reservations");
      const snapshot = await getDocs(reservationsRef);

      const uniqueEmails = new Set();
      const uniquePhones = new Set();
      let todayCount = 0;
      const todaysList: Reservation[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Handle different date formats consistently
        let reservationDate: string;
        if (
          typeof data.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(data.date)
        ) {
          // Already in YYYY-MM-DD format
          reservationDate = data.date;
        } else if (data.date instanceof Timestamp) {
          // Firestore Timestamp
          reservationDate = data.date.toDate().toLocaleDateString("en-CA", {
            timeZone: timezone,
          });
        } else {
          // ISO string or other format
          reservationDate = new Date(data.date).toLocaleDateString("en-CA", {
            timeZone: timezone,
          });
        }

        // Compare just the date parts
        if (reservationDate === todayLocal) {
          todayCount++;
          todaysList.push({
            id: doc.id,
            date:
              data.date instanceof Timestamp
                ? data.date.toDate()
                : new Date(data.date + "T12:00:00"),
            time: data.time,
            name: data.name,
            guests: data.guests,
            phone: data.phone,
            email: data.email,
            status: data.status || "pending",
            comments: data.comments || "",
            createdAt: data.createdAt,
            reminderSent: data.reminderSent,
            reminderSentAt: data.reminderSentAt,
            phoneVerified: data.phoneVerified ?? false,
          });
        }

        if (data.email) uniqueEmails.add(data.email);
        if (data.phone) uniquePhones.add(data.phone);
      });

      // Sort today's reservations by time
      todaysList.sort((a, b) => {
        const timeA = convertTimeToMinutes(a.time);
        const timeB = convertTimeToMinutes(b.time);
        return timeA - timeB;
      });

      setTodaysReservations(todaysList);
      const cateringSnap = await getDocs(collection(db, "catering"));
      const newCateringCount = cateringSnap.docs.filter(
        (d) => d.data().status === "pending",
      ).length;

      const downloadsSnap = await getDocs(collection(db, "menuDownloads"));

      setMetrics({
        totalReservations: snapshot.size,
        uniqueCustomers: uniqueEmails.size + uniquePhones.size,
        todayReservations: todayCount,
        totalCatering: cateringSnap.size,
        newCatering: newCateringCount,
        menuDownloads: downloadsSnap.size,
      });
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Real-time listener for new reservations (unacknowledged)
  useEffect(() => {
    const reservationsRef = collection(db, "reservations");
    const q = query(
      reservationsRef,
      orderBy("createdAt", "desc"),
      limit(50), // Check last 50 reservations
    );

    let isInitialLoad = true;
    let previousIds: Set<string> = new Set();

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reservations = snapshot.docs
          .filter((doc) => {
            const data = doc.data();
            // Include if marked is false OR if marked field doesn't exist
            return data.marked === false || data.marked === undefined;
          })
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              // Convert Firestore Timestamp to JavaScript Date
              date:
                data.date instanceof Timestamp
                  ? data.date.toDate()
                  : new Date(data.date + "T12:00:00"),
              // Convert createdAt Timestamp to ISO string for proper parsing
              createdAt:
                data.createdAt instanceof Timestamp
                  ? data.createdAt.toDate().toISOString()
                  : data.createdAt,
            };
          }) as Reservation[];

        // Check for new reservations (not on initial load)
        if (!isInitialLoad) {
          const currentIds = new Set(reservations.map((r) => r.id));
          const newReservations = reservations.filter(
            (r) => !previousIds.has(r.id),
          );

          if (newReservations.length > 0) {
            playNotificationSound();
            // Show toast for new reservation
            toast.success(
              `🔔 New reservation from ${newReservations[0].name}!`,
              { duration: 5000 },
            );
          }
          previousIds = currentIds;
        } else {
          previousIds = new Set(reservations.map((r) => r.id));
          isInitialLoad = false;
        }

        setPendingReservations(reservations);
      },
      (error) => {
        console.error("Error listening to reservations:", error);
      },
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, []);

  // Real-time listener for today's reservations (status updates, confirmations, etc.)
  useEffect(() => {
    if (!timezone) return;

    const todayLocal = new Date().toLocaleDateString("en-CA", {
      timeZone: timezone,
    });

    const reservationsRef = collection(db, "reservations");

    // Set up real-time listener for all reservations
    const unsubscribe = onSnapshot(
      reservationsRef,
      (snapshot) => {
        const todaysList: Reservation[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Handle different date formats consistently
          let reservationDate: string;
          if (
            typeof data.date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(data.date)
          ) {
            reservationDate = data.date;
          } else if (data.date instanceof Timestamp) {
            reservationDate = data.date.toDate().toLocaleDateString("en-CA", {
              timeZone: timezone,
            });
          } else {
            reservationDate = new Date(data.date).toLocaleDateString("en-CA", {
              timeZone: timezone,
            });
          }

          // Only include today's reservations
          if (reservationDate === todayLocal) {
            todaysList.push({
              id: doc.id,
              date:
                data.date instanceof Timestamp
                  ? data.date.toDate()
                  : new Date(data.date + "T12:00:00"),
              time: data.time,
              name: data.name,
              guests: data.guests,
              phone: data.phone,
              email: data.email,
              status: data.status || "pending",
              comments: data.comments || "",
              createdAt: data.createdAt,
              reminderSent: data.reminderSent,
              reminderSentAt: data.reminderSentAt,
              attendanceStatus: data.attendanceStatus,
              phoneVerified: data.phoneVerified ?? false,
            });
          }
        });

        // Sort by time
        todaysList.sort((a, b) => {
          const timeA = convertTimeToMinutes(a.time);
          const timeB = convertTimeToMinutes(b.time);
          return timeA - timeB;
        });

        setTodaysReservations(todaysList);
      },
      (error) => {
        console.error("Error listening to today's reservations:", error);
      },
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [timezone]);

  const fetchMessages = async () => {
    try {
      const messagesRef = collection(db, "messages");
      const q = query(messagesRef, orderBy("timestamp", "desc"));
      const snapshot = await getDocs(q);
      const messagesList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(),
      })) as Message[];
      setMessages(messagesList);
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  // Send reminder email
  const handleSendReminder = async (reservation: Reservation) => {
    if (!canSendReminder(reservation)) {
      toast.error("Reminder already sent recently");
      return;
    }

    try {
      toast.loading("Sending reminder...", { id: reservation.id });
      const response = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId: reservation.id,
          email: reservation.email,
          name: reservation.name,
          date: reservation.date,
          time: reservation.time,
          guests: reservation.guests,
        }),
      });

      if (!response.ok) throw new Error("Failed to send reminder");

      // Update local state
      setTodaysReservations((prev) =>
        prev.map((r) =>
          r.id === reservation.id
            ? { ...r, reminderSent: true, reminderSentAt: Timestamp.now() }
            : r,
        ),
      );

      toast.success("Reminder sent successfully", { id: reservation.id });
    } catch (error) {
      console.error("Error sending reminder:", error);
      toast.error("Failed to send reminder", { id: reservation.id });
    }
  };

  // Update attendance status (show/no-show)
  const handleAttendanceUpdate = async (
    reservationId: string,
    status: "show" | "no-show" | "default",
  ) => {
    try {
      const reservationRef = doc(db, "reservations", reservationId);
      await updateDoc(reservationRef, {
        attendanceStatus: status === "default" ? null : status,
      });

      // Update local state
      setTodaysReservations((prev) =>
        prev.map((res) =>
          res.id === reservationId
            ? {
                ...res,
                attendanceStatus: status === "default" ? undefined : status,
              }
            : res,
        ),
      );

      toast.success(
        status === "show"
          ? "Marked as showed"
          : status === "no-show"
            ? "Marked as no-show"
            : "Status cleared",
      );
    } catch (error) {
      console.error("Error updating attendance status:", error);
      toast.error("Failed to update status");
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        await Promise.all([fetchMetrics(), fetchMessages()]);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [timezone]);

  // console.log(totalViews)

  // Add new state for loading
  const [markingAsRead, setMarkingAsRead] = useState(false);

  const markAllCateringRead = async () => {
    setMarkingAsRead(true);
    try {
      const cateringRef = collection(db, "catering");
      const unreadQuery = query(cateringRef, where("status", "==", "pending"));
      const snapshot = await getDocs(unreadQuery);

      const updatePromises = snapshot.docs.map((doc) =>
        updateDoc(doc.ref, { status: "completed" }),
      );

      await Promise.all(updatePromises);
      await fetchMetrics();
    } catch (error) {
      console.error("Error marking catering as read:", error);
    } finally {
      setMarkingAsRead(false);
    }
  };

  // Chart options
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: "Daily Page Views",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  // Chart data
  const chartData = {
    labels: dailyViews.map((item) => new Date(item.date).toLocaleDateString()),
    datasets: [
      {
        label: "Page Views",
        data: dailyViews.map((item) => item.views),

        backgroundColor: "rgba(140, 140, 140, 0.5)",
        tension: 0.3,
      },
    ],
  };

  const handleMarkReservation = async (
    reservationId: string,
    showToast = true,
  ) => {
    try {
      const reservationRef = doc(db, "reservations", reservationId);
      await updateDoc(reservationRef, {
        marked: true,
        markedAt: new Date(),
      });

      setPendingReservations((prev) =>
        prev.filter((reservation) => reservation.id !== reservationId),
      );

      if (showToast) {
        toast.success("Reservation acknowledged");
      }
    } catch (error) {
      console.error("Error marking reservation:", error);
      toast.error("Failed to acknowledge reservation");
    }
  };

  useEffect(() => {
    if (pendingReservations.length > 0) {
      setShowMobileNotification(true);
    }
  }, [pendingReservations]);

  const handleMarkAsRead = async (messageId: string) => {
    setIsMarkingRead(messageId);
    try {
      const messageRef = doc(db, "messages", messageId);
      await updateDoc(messageRef, {
        status: "read",
      });
      await fetchMessages();
      toast.success("Message marked as read");
    } catch (error) {
      console.error("Error marking message as read:", error);
      toast.error("Failed to mark message as read");
    } finally {
      setIsMarkingRead("");
    }
  };

  useEffect(() => {
    const fetchTodayReservations = async () => {
      try {
        // Get today's date range in local timezone
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Convert to UTC for Firestore query
        const todayUTC = new Date(today.toUTCString());
        const tomorrowUTC = new Date(tomorrow.toUTCString());

        const reservationsRef = collection(db, "reservations");
        const q = query(
          reservationsRef,
          where("date", ">=", Timestamp.fromDate(todayUTC)),
          where("date", "<", Timestamp.fromDate(tomorrowUTC)),
        );

        const querySnapshot = await getDocs(q);
        const reservations = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Reservation[];

        // Sort by time
        reservations.sort((a, b) => {
          const timeA = convertTo24Hour(a.time);
          const timeB = convertTo24Hour(b.time);
          return timeA.localeCompare(timeB);
        });

        setTodayReservations(reservations);
      } catch (error) {
        console.error("Error fetching today reservations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTodayReservations();
  }, []);

  // Helper function to convert time to 24-hour format for sorting
  const convertTo24Hour = (time12h: string) => {
    const [time, modifier] = time12h.split("");
    let [hours, minutes] = time.split(":");

    if (hours === "12") {
      hours = "00";
    }

    if (modifier === "PM") {
      hours = String(parseInt(hours, 10) + 12);
    }

    return `${hours}:${minutes}`;
  };

  // Helper function to get status badge styles
  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-muted text-foreground";
      default:
        return "bg-muted text-foreground";
    }
  };

  // Function to check if a reservation is for today (in local time)
  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  return (
    <AdminLayout>
      <PageTransition>
        {/* Invisible layer — unlocks AudioContext on iOS on first tap */}
        <div className="fixed inset-0 z-[-1]" onClick={unlockAudio} onTouchStart={unlockAudio} />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: "var(--card)",
              color: "var(--card-foreground)",
              zIndex: 9999,
            },
            className: "sm:max-w-[90vw] md:max-w-md",
          }}
          containerStyle={{
            top: 40,
            left: 20,
            right: 20,
          }}
        />
        {/* Header */}
        <div className="p-7 mb-6 relative bg-card rounded-2xl ring-1 ring-foreground/10">
          <h1 className="text-3xl font-bold text-foreground">
            Thaiphoon Restaurant
          </h1>
          <p className="mt-1 text-muted-foreground">
            Welcome back! Here's what's happening today.
          </p>
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none flex">
            <Utensils className="w-20 h-20 text-muted-foreground" />
          </div>
        </div>

        {activeTab === "dashboard" ? (
          <>
            {/* Compact Status & Stats Bar */}
            {(() => {
              const status = getBusinessStatus();
              return (
                <Card className="mb-6 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      {/* Status & Time */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          {status.isOpen ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="font-semibold text-foreground">
                            {status.isOpen ? "Open" : "Closed"}
                          </span>
                          {status.isOpen && status.currentPeriod && (
                            <Badge
                              variant="outline"
                              className="text-xs text-muted-foreground border-border"
                            >
                              {status.currentPeriod}
                            </Badge>
                          )}
                        </div>
                        <div className="hidden sm:flex items-center gap-1 text-sm text-muted-foreground border-l border-border pl-4">
                          <Clock className="w-4 h-4" />
                          <span className="font-mono font-medium text-muted-foreground">
                            {currentTimeDisplay}
                          </span>
                          <span className="text-muted-foreground">·</span>
                          <span>{currentDateDisplay}</span>
                        </div>
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-6 text-sm">
                        <Link
                          href="/admin/reservation"
                          className="flex items-center gap-2 hover:bg-muted/50 px-2 py-1 rounded transition-colors"
                        >
                          <CalendarDays className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Today</span>
                          <span className="font-bold text-foreground">
                            {metrics.todayReservations}
                          </span>
                        </Link>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground hidden md:inline">
                            Total
                          </span>
                          <span className="font-bold text-foreground">
                            {metrics.totalReservations}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground hidden md:inline">
                            Customers
                          </span>
                          <span className="font-bold text-foreground">
                            {metrics.uniqueCustomers}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ChefHat className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground hidden md:inline">
                            Catering
                          </span>
                          <span className="font-bold text-foreground">
                            {metrics.newCatering}
                          </span>
                          {metrics.newCatering > 0 && (
                            <button
                              onClick={markAllCateringRead}
                              disabled={markingAsRead}
                              className="text-[10px] text-muted-foreground hover:text-muted-foreground underline"
                            >
                              clear
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4 text-muted-foreground" />
                          <span className="text-muted-foreground hidden md:inline">
                            Menu DLs
                          </span>
                          <span className="font-bold text-foreground">
                            {metrics.menuDownloads}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Today's Hours - Inline */}
                    {status.todayHours && (
                      <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium">Hours:</span>
                        {formatHoursDisplay(status.todayHours).map(
                          (hourStr: string, idx: number) => (
                            <span
                              key={idx}
                              className="bg-muted/50 px-2 py-0.5 rounded text-muted-foreground"
                            >
                              {hourStr}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Today's Reservations - Enhanced Full Width List */}
            <Card className="mb-6 shadow-sm">
              <CardHeader className="py-3 px-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Today&apos;s Reservations
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-muted text-muted-foreground"
                    >
                      {todaysReservations.length} total
                    </Badge>
                  </div>
                  <Link href="/admin/reservation">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground hover:text-muted-foreground h-7 px-2 gap-1"
                    >
                      View All <ArrowRightCircle className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {todaysReservations.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    No reservations for today
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[520px] overflow-y-auto p-1.5">
                    {todaysReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        onClick={() => setSelectedReservation(reservation)}
                        className={`bg-card rounded-xl overflow-hidden border-l-4 ring-1 ring-foreground/10 transition-all duration-200 cursor-pointer hover:ring-foreground/20 ${
                          reservation.status?.toLowerCase() === "cancelled"
                            ? "border-red-500"
                            : reservation.attendanceStatus === "show"
                              ? "border-green-500"
                              : reservation.attendanceStatus === "no-show"
                                ? "border-orange-500"
                                : isReservationPassed(reservation.time)
                                  ? "border-border"
                                  : "border-border"
                        }`}
                      >
                        <div className="flex items-stretch">
                          <div
                            className={`w-20 sm:w-24 border-r flex items-center justify-center px-1.5 ${
                              reservation.status?.toLowerCase() === "cancelled"
                                ? "bg-red-50 dark:bg-red-950"
                                : "bg-muted/50"
                            }`}
                          >
                            <div className="text-center leading-none flex flex-col items-center gap-1.5">
                              <Avatar className="w-10 h-10">
                                <AvatarFallback className="bg-[#A3B18A]/20 text-[#7a9065] font-semibold text-[10px]">
                                  {reservation.name
                                    .split(" ")
                                    .map((n: string) => n[0])
                                    .slice(0, 2)
                                    .join("")
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div
                                className={`text-2xl sm:text-3xl font-black tracking-tight whitespace-nowrap ${
                                  reservation.status?.toLowerCase() ===
                                  "cancelled"
                                    ? "text-red-300 line-through"
                                    : isReservationPassed(reservation.time)
                                      ? "text-muted-foreground"
                                      : "text-foreground"
                                }`}
                              >
                                {reservation.time.split(" ")[0]}
                              </div>
                              {reservation.status?.toLowerCase() ===
                              "cancelled" ? (
                                <div className="text-[10px] font-bold text-red-500 tracking-wide uppercase">
                                  Cancelled
                                </div>
                              ) : (
                                <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                                  {reservation.time.split(" ")[1] ?? ""}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 p-3">
                            <div className="flex items-start justify-between gap-2 mb-1.5">
                              <div className="min-w-0">
                                <h3 className="font-semibold text-foreground truncate text-sm">
                                  {reservation.name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span className="flex items-center">
                                    <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                                    {formatReadableDatePST(
                                      reservation.date,
                                      timezone,
                                    )}
                                  </span>
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border px-2 py-0.5">
                                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span className="text-base leading-none font-bold text-foreground">
                                      {reservation.guests}
                                    </span>
                                    <span className="text-[11px] font-medium text-muted-foreground">
                                      {reservation.guests === 1
                                        ? "guest"
                                        : "guests"}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {!reservation.attendanceStatus && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      reservation.status === "confirmed"
                                        ? "border-border text-foreground bg-muted"
                                        : reservation.status === "cancelled"
                                          ? "border-red-300 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300"
                                          : "border-border text-muted-foreground bg-muted/50"
                                    }`}
                                  >
                                    {reservation.status === "confirmed"
                                      ? "Confirmed"
                                      : reservation.status === "cancelled"
                                        ? "Cancelled"
                                        : "Pending"}
                                  </Badge>
                                )}
                                {reservation.attendanceStatus && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${
                                      reservation.attendanceStatus === "show"
                                        ? "border-green-300 text-green-700 bg-green-100 dark:bg-green-950 dark:text-green-300"
                                        : "border-orange-300 text-orange-700 bg-orange-100 dark:bg-orange-950 dark:text-orange-300"
                                    }`}
                                  >
                                    {reservation.attendanceStatus === "show"
                                      ? "Showed"
                                      : "No-Show"}
                                  </Badge>
                                )}
                                {(() => {
                                  const followUpLabel = getFollowUpChipLabel(
                                    reservation,
                                    timezone,
                                    followUpSettings,
                                  );
                                  return followUpLabel ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-blue-300 text-blue-700 bg-blue-50 dark:bg-blue-950 dark:text-blue-300"
                                    >
                                      {followUpLabel}
                                    </Badge>
                                  ) : null;
                                })()}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-2">
                              <span className="flex items-center gap-1.5">
                                <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                                {reservation.phone}
                                {reservation.phoneVerified && (
                                  <span className="inline-flex items-center text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded px-1 py-0.5">
                                    ✓ Verified
                                  </span>
                                )}
                              </span>
                              {reservation.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span className="truncate max-w-[220px]">
                                    {reservation.email}
                                  </span>
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground mb-2">
                              <span className="flex items-center">
                                <CalendarDays className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                                Reservation made:{""}
                                {formatReservationCreatedAt(
                                  (reservation as any).createdAt,
                                )}
                              </span>
                              <span
                                className={`flex items-center ${
                                  reservation.reminderSent
                                    ? "text-muted-foreground"
                                    : "text-muted-foreground"
                                }`}
                              >
                                <Mail className="w-3.5 h-3.5 mr-1" />
                                Reminder:{""}
                                {reservation.reminderSent &&
                                reservation.reminderSentAt
                                  ? `Sent ${formatReminderTime(reservation.reminderSentAt.toDate())}`
                                  : "Not sent"}
                              </span>
                            </div>

                            {reservation.comments && (
                              <div className="text-xs text-muted-foreground bg-muted/50 border border-border p-2 rounded-md mb-2">
                                <span className="font-medium text-xs text-foreground mr-1">
                                  Notes:
                                </span>
                                {reservation.comments}
                              </div>
                            )}

                            <div
                              className="flex flex-wrap items-center justify-between gap-1.5 border-t pt-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`text-xs ${
                                    reservation.attendanceStatus === "show"
                                      ? "text-green-700 bg-green-100 border-green-300"
                                      : "text-muted-foreground bg-card hover:bg-green-100 dark:hover:bg-green-900 hover:text-green-700"
                                  } h-7 px-2`}
                                  onClick={() =>
                                    handleAttendanceUpdate(
                                      reservation.id,
                                      reservation.attendanceStatus === "show"
                                        ? "default"
                                        : "show",
                                    )
                                  }
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Show
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={`text-xs ${
                                    reservation.attendanceStatus === "no-show"
                                      ? "text-orange-700 bg-orange-100 border-orange-300"
                                      : "text-muted-foreground bg-card hover:bg-orange-100 dark:hover:bg-orange-900 hover:text-orange-700"
                                  } h-7 px-2`}
                                  onClick={() =>
                                    handleAttendanceUpdate(
                                      reservation.id,
                                      reservation.attendanceStatus === "no-show"
                                        ? "default"
                                        : "no-show",
                                    )
                                  }
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-1" />
                                  No-show
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSendReminder(reservation)}
                                disabled={!canSendReminder(reservation)}
                                className="text-xs h-7 px-2 text-muted-foreground"
                              >
                                <Mail className="w-3.5 h-3.5 mr-1" />
                                {canSendReminder(reservation)
                                  ? "Send Reminder"
                                  : "Reminder Sent"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* New Bookings — shadcn Alert per reservation */}
            {pendingReservations.length > 0 && (
              <div id="pending-reservations" className="mb-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">
                      New Bookings
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-xs bg-muted text-muted-foreground"
                    >
                      {pendingReservations.length} unread
                    </Badge>
                  </div>
                  {pendingReservations.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const count = pendingReservations.length;
                        for (const res of pendingReservations) {
                          await handleMarkReservation(res.id, false);
                        }
                        toast.success(`${count} reservations acknowledged`);
                      }}
                      className="text-xs text-muted-foreground hover:text-muted-foreground h-7 px-2"
                    >
                      Acknowledge all
                    </Button>
                  )}
                </div>

                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {pendingReservations.map((reservation) => {
                    const initials = reservation.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <div
                        key={reservation.id}
                        onClick={() => setSelectedReservation(reservation)}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                      >
                        {/* Avatar */}
                        <Avatar className="mt-0.5 shrink-0 w-9 h-9">
                          <AvatarFallback className="bg-[#A3B18A]/20 text-[#7a9065] font-semibold text-xs">
                            {initials}
                          </AvatarFallback>
                        </Avatar>

                        {/* Main content */}
                        <div className="flex-1 min-w-0">
                          {/* Name + timestamp */}
                          <div className="flex items-baseline justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-foreground truncate animate-pulse">
                              {reservation.name}
                            </span>
                            {reservation.createdAt && (
                              <span className="text-[11px] text-muted-foreground/60 shrink-0">
                                {formatTimeAgo(new Date(reservation.createdAt))}
                              </span>
                            )}
                          </div>

                          {/* Date · time · guests row */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {reservation.date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                            <span className="text-border">·</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {reservation.time}
                            </span>
                            <span className="text-border">·</span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {reservation.guests}{" "}
                              {reservation.guests === 1 ? "guest" : "guests"}
                            </span>
                          </div>

                          {/* Phone */}
                          {reservation.phone && (
                            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              {reservation.phone}
                            </div>
                          )}

                          {/* Comments */}
                          {reservation.comments && (
                            <p className="mt-1.5 text-xs text-muted-foreground italic truncate">
                              &ldquo;{reservation.comments.slice(0, 70)}
                              {reservation.comments.length > 70 ? "…" : ""}
                              &rdquo;
                            </p>
                          )}
                        </div>

                        {/* Acknowledge button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted mt-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkReservation(reservation.id);
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-xl">
                  <Mail className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-xl">Messages</CardTitle>
                  <CardDescription>
                    Customer inquiries and feedback
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`group rounded-xl p-4 transition-all duration-200 ${
                      message.status === "unread"
                        ? "bg-muted ring-1 ring-foreground/10"
                        : "bg-muted/50 ring-1 ring-foreground/8"
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-4">
                        <div
                          className={`p-3 rounded-xl ${message.status === "unread" ? "bg-card ring-1 ring-foreground/10" : "bg-muted"}`}
                        >
                          <User className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {message.name}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {message.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.timestamp.toLocaleDateString()} at{""}
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                          <p className="mt-3 text-muted-foreground bg-card rounded-xl p-3 ring-1 ring-foreground/10">
                            {message.message}
                          </p>
                        </div>
                      </div>
                      {message.status === "unread" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkAsRead(message.id)}
                          disabled={isMarkingRead === message.id}
                          className="bg-card hover:bg-muted/50 text-muted-foreground border-border"
                        >
                          {isMarkingRead === message.id
                            ? "Marking..."
                            : "Mark Read"}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {messages.length === 0 && (
                  <div className="text-center py-12">
                    <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
                      <Mail className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                      No messages yet
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Customer messages will appear here
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Spacer so fixed bottom notification doesn't cover content on mobile */}
        {/* {showMobileNotification && pendingReservations.length > 0 && (
          <div className="h-24 md:hidden" />
        )}

        {showMobileNotification && (
          <MobileNotification
            count={pendingReservations.length}
            onClose={() => setShowMobileNotification(false)}
          />
        )} */}

        {/* Reservation Detail Modal */}
        <Dialog
          open={!!selectedReservation}
          onOpenChange={(open) => {
            if (!open) setSelectedReservation(null);
          }}
        >
          <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
            {selectedReservation && (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedReservation.name}</DialogTitle>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        selectedReservation.attendanceStatus === "show"
                          ? "border-border text-foreground bg-muted"
                          : selectedReservation.attendanceStatus === "no-show"
                            ? "border-border text-muted-foreground bg-muted"
                            : selectedReservation.status === "confirmed"
                              ? "border-border text-foreground bg-muted"
                              : "border-border text-muted-foreground bg-muted"
                      }`}
                    >
                      {selectedReservation.attendanceStatus === "show"
                        ? "Showed"
                        : selectedReservation.attendanceStatus === "no-show"
                          ? "No-Show"
                          : selectedReservation.status === "confirmed"
                            ? "Confirmed"
                            : "Pending"}
                    </Badge>
                    {selectedReservation.reminderSent && (
                      <span className="text-xs text-muted-foreground">
                        Reminder sent{" "}
                        {selectedReservation.reminderSentAt &&
                          formatReminderTime(
                            selectedReservation.reminderSentAt.toDate(),
                          )}
                      </span>
                    )}
                  </div>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Date & Time */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Date & Time
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {typeof selectedReservation.date === "string"
                          ? selectedReservation.date
                          : selectedReservation.date.toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                      </p>
                      <p className="text-base font-bold text-foreground">
                        {selectedReservation.time}
                      </p>
                    </div>
                  </div>

                  {/* Guests */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Party Size
                      </p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedReservation.guests}{" "}
                        {selectedReservation.guests === 1 ? "Guest" : "Guests"}
                      </p>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Contact
                    </p>
                    <a
                      href={`tel:${selectedReservation.phone}`}
                      className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 text-foreground transition-colors hover:bg-muted"
                    >
                      <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">
                        {selectedReservation.phone}
                      </span>
                    </a>
                    {selectedReservation.email && (
                      <a
                        href={`mailto:${selectedReservation.email}`}
                        className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 text-foreground transition-colors hover:bg-muted"
                      >
                        <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium break-all">
                          {selectedReservation.email}
                        </span>
                      </a>
                    )}
                  </div>

                  {/* Special Requests */}
                  {selectedReservation.comments && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Special Requests
                      </p>
                      <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground italic">
                        &quot;{selectedReservation.comments}&quot;
                      </p>
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-col">
                  <Button
                    className="w-full"
                    onClick={() => handleSendReminder(selectedReservation)}
                    disabled={!canSendReminder(selectedReservation)}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    {selectedReservation.reminderSent
                      ? `Reminder Sent ${selectedReservation.reminderSentAt ? formatReminderTime(selectedReservation.reminderSentAt.toDate()) : ""}`
                      : "Send Reminder Email"}
                  </Button>

                  <div className="flex gap-2 w-full">
                    <Button
                      variant="outline"
                      className={`flex-1 ${
                        selectedReservation.attendanceStatus === "show"
                          ? "bg-muted text-foreground border-foreground/20"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => {
                        handleAttendanceUpdate(
                          selectedReservation.id,
                          selectedReservation.attendanceStatus === "show"
                            ? "default"
                            : "show",
                        );
                        setSelectedReservation((prev) =>
                          prev
                            ? {
                                ...prev,
                                attendanceStatus:
                                  prev.attendanceStatus === "show"
                                    ? undefined
                                    : "show",
                              }
                            : null,
                        );
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      {selectedReservation.attendanceStatus === "show"
                        ? "Showed ✓"
                        : "Mark Show"}
                    </Button>

                    <Button
                      variant="outline"
                      className={`flex-1 ${
                        selectedReservation.attendanceStatus === "no-show"
                          ? "bg-muted text-foreground border-foreground/20"
                          : "text-muted-foreground"
                      }`}
                      onClick={() => {
                        handleAttendanceUpdate(
                          selectedReservation.id,
                          selectedReservation.attendanceStatus === "no-show"
                            ? "default"
                            : "no-show",
                        );
                        setSelectedReservation((prev) =>
                          prev
                            ? {
                                ...prev,
                                attendanceStatus:
                                  prev.attendanceStatus === "no-show"
                                    ? undefined
                                    : "no-show",
                              }
                            : null,
                        );
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      {selectedReservation.attendanceStatus === "no-show"
                        ? "No-Show ✓"
                        : "Mark No-Show"}
                    </Button>
                  </div>

                  {pendingReservations.some(
                    (r) => r.id === selectedReservation.id,
                  ) && (
                    <Button
                      className="w-full"
                      onClick={() => {
                        handleMarkReservation(selectedReservation.id);
                        setSelectedReservation(null);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Acknowledge Booking
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </PageTransition>
    </AdminLayout>
  );
}
