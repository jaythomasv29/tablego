import { useInitialBusinessDate } from '@/components/reservations/useInitialBusinessDate';
import { useBusinessPolicy } from '@/components/reservations/useBusinessPolicy';
import { ReservationReceipt, type ReceiptDetails } from '@/components/reservations/ReservationReceipt';
import MagneticButton from '@/components/MagneticButton';
import EmailSignup from '@/components/mailing/EmailSignup';
import PromotionModal from '@/components/mailing/PromotionModal';
import { calendarDate, slotsForDate, openAt } from '@/lib/reservations/availability';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Mail,
  MessageSquare,
  ShoppingBag,
  Users,
  Utensils,
  X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import DatePicker from "./components/DatePicker";
import GuestInfo from "./components/GuestInfo";
import AdditionalInfo from "./components/AdditionalInfo";
import ProgressBar from "./components/ProgressBar";
import { useTimezone } from "./contexts/TimezoneContext";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { TimeSlot } from "./types/TimeSlot";

const TrendingModal = dynamic(() => import("./components/TrendingModal").then(module => module.TrendingModal), {
  ssr: false, loading: () => <p role="status" className="fixed bottom-4 left-4 z-50 rounded bg-white p-4 text-zinc-900">Loading menu highlights…</p>,
});

export interface ReservationData {
  date: Date;
  time: string;
  guests: number;
  name: string;
  email: string;
  phone: string;
  comments: string;
}

const initialData: ReservationData = {
  date: new Date(),
  time: "19:00",
  guests: 2,
  name: "",
  email: "",
  phone: "",
  comments: "",
};

// interface TimeSlot {
//   time: string;
// }

// Add SpecialDate interface
interface SpecialDate {
  date: string;
  reason?: string;
  closureType?: "full" | "lunch" | "dinner";
}

interface BannerData {
  text: string;
  link?: string;
  linkText?: string;
}

interface DayPeriodHours {
  open: string;
  close: string;
  isOpen: boolean;
  customRanges?: { start: string; end: string }[];
}

interface BusinessHours {
  [key: string]: {
    lunch: DayPeriodHours;
    dinner: DayPeriodHours;
  };
}

const PILLARS = ["Wok-Fired", "Family Friendly", "Fresh Ingredients"];
const SIAM_PALETTE = {
  primary: "#F9F7F2",
  accent: "#A3B18A",
  surface: "#EAE0D5",
  text: "#121212",
};
const HERO_VIDEO = "/images/slow-mo-hero.mp4";

function App() {
  const { timezone, restaurant, loading: timezoneLoading, error: timezoneError } = useTimezone();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { businessHours, specialDates, policy, error: policyError, cutoffMinutes: reservationCutoffMinutes, leadTimeMinutes: minimumLeadTimeMinutes } = useBusinessPolicy();
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [isReserveOpen, setIsReserveOpen] = useState(false);
  const [showReservationSuccess, setShowReservationSuccess] = useState(false);
  const [modalValidationError, setModalValidationError] = useState<
    string | null
  >(null);
  const submissionKey = useRef<{ key: string; payload: string } | null>(null);
  const [managementLink, setManagementLink] = useState('');
  const [receipt, setReceipt] = useState<ReceiptDetails | null>(null);
  const initialBusinessDate = useInitialBusinessDate(timezone, timezoneLoading, timezoneError);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [savedBanner, setBannerData] = useState<BannerData | null>(null);
  const bannerData = restaurant.promotion ? { text: restaurant.promotion, link: restaurant.promotionUrl, linkText: 'Details' } : savedBanner;
  const [isEditingGuests, setIsEditingGuests] = useState(false);
  const [guestDraft, setGuestDraft] = useState("2");
  const [showTrending, setShowTrending] = useState(false);
  const [tick, setTick] = useState(0);
  const [showPromotion, setShowPromotion] = useState(false);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const [bannerHeight, setBannerHeight] = useState(150);
  useEffect(() => {
    const element = bannerRef.current; if (!element) return;
    const observer = new ResizeObserver(() => setBannerHeight(element.getBoundingClientRect().height));
    observer.observe(element); return () => observer.disconnect();
  }, []);
  const openerRef = useRef<HTMLElement | null>(null);
  const reservePanelRef = useRef<HTMLDivElement | null>(null);

  // Re-evaluate open status every minute
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const isRestaurantOpen = useMemo(
    () => { try { return policy ? openAt(policy) : null; } catch { return null; } },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [policy, tick],
  );
  const guestInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.body.style.overflow = isReserveOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isReserveOpen]);

  useEffect(() => onSnapshot(doc(db, 'settings', 'banner'), snapshot => {
    const data = snapshot.data(); setBannerData(data?.text ? data as BannerData : null);
  }, () => setBannerData(null)), []);

  useEffect(() => {
    if (initialBusinessDate) setFormData(previous => ({ ...previous, date: initialBusinessDate }));
  }, [initialBusinessDate]);

  useEffect(() => {
    if (!isEditingGuests) {
      setGuestDraft(String(formData.guests));
    }
  }, [formData.guests, isEditingGuests]);

  useEffect(() => {
    if (isEditingGuests) {
      guestInputRef.current?.focus();
      guestInputRef.current?.select();
    }
  }, [isEditingGuests]);

  const generateTimeSlots = useCallback((date: Date, hours: BusinessHours): TimeSlot[] => {
    try { return slotsForDate(calendarDate(date), { businessHours: hours, specialDates, timezone, cutoffMinutes: reservationCutoffMinutes, leadTimeMinutes: minimumLeadTimeMinutes }); }
    catch { return []; }
  }, [specialDates, timezone, minimumLeadTimeMinutes, reservationCutoffMinutes]);

  useEffect(() => {
    if (!businessHours || !policy) { setAvailableTimeSlots([]); return; }
    const slots = generateTimeSlots(formData.date, businessHours);
    setAvailableTimeSlots(slots);
    if (!isSubmitting && !showReservationSuccess && formData.time && !slots.some((slot) => slot.time === formData.time)) {
      setFormData((prev) => ({ ...prev, time: "" }));
    }
  }, [formData.date, formData.time, businessHours, policy, generateTimeSlots, isSubmitting, showReservationSuccess]);

  const steps = [
    { title: "Date & Time", icon: Calendar },
    { title: "Guest Details", icon: Users },
  ];

  const updateFormData = (data: Partial<ReservationData>) => {
    if (isSubmitting) return;
    setModalValidationError(null);
    setFormData((prev) => ({
      ...prev,
      ...data,
    }));
  };

  const nextStep = () => { if (!isSubmitting) setStep((prev) => Math.min(prev + 1, steps.length - 1)); };
  const prevStep = () => { if (!isSubmitting) setStep((prev) => Math.max(prev - 1, 0)); };
  const openReserveModal = () => {
    openerRef.current = document.activeElement as HTMLElement;
    setShowReservationSuccess(false);
    setModalValidationError(null);
    submissionKey.current = null;
    setManagementLink('');
    setReceipt(null);
    setIsReserveOpen(true);
  };
  const closeReserveModal = () => {
    if (isSubmitting) return;
    setIsReserveOpen(false);
    setShowReservationSuccess(false);
    setModalValidationError(null);
    setPhoneVerified(false);
    setSmsOptIn(false);
    setStep(0);
  };

  const isStepOneValid = () =>
    Boolean(formData.date && formData.time && formData.guests > 0);
  const otpEnabled = process.env.NEXT_PUBLIC_OTP_ENABLED === "true";

  const isStepTwoValid = () => {
    const phoneDigits = formData.phone.replace(/\D/g, "");
    return Boolean(
      formData.name.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim()) &&
      phoneDigits.length === 10 &&
      (!otpEnabled || phoneVerified),
    );
  };

  const handleContinue = () => {
    if (!isStepOneValid()) {
      setModalValidationError(
        "Please select date, time, and guest count before continuing.",
      );
      return;
    }
    setModalValidationError(null);
    nextStep();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!isStepTwoValid()) {
      setModalValidationError(
        "Please complete name, email, and phone before confirming.",
      );
      return;
    }
    if (!policy || policyError) { setModalValidationError(policyError || 'Booking settings are still loading. Please try again.'); return; }

    setIsSubmitting(true);
    try {
      const payload = JSON.stringify({ formData: { ...formData, date: calendarDate(formData.date) }, smsOptIn });
      if (submissionKey.current?.payload !== payload) submissionKey.current = { key: crypto.randomUUID(), payload };
      const response = await fetch('/api/send-confirmation', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionKey.current.key }, body: payload,
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Failed to process reservation");
      }

      setModalValidationError(null);
      setManagementLink(result.managementUrl);
      const details = result.reservationDetails;
      setReceipt({ name: details.name, date: details.date, time: details.time, guests: details.guests, timezone: details.timezone, status: details.status });
      submissionKey.current = null;
      setShowReservationSuccess(true);
    } catch (error) {
      console.error("Reservation submission failed:", error);
      setModalValidationError(
        error instanceof Error ? error.message : "Unable to complete reservation right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (date: Date) => {
    if (isSubmitting) return;
    setFormData((prev) => ({ ...prev, date, time: "" }));
  };

  const handleDateTimeUpdate = (date: Date, time: string) => {
    setModalValidationError(null);
    setFormData((prev) => ({ ...prev, date, time }));
  };

  const startGuestEdit = () => {
    setGuestDraft(String(formData.guests));
    setIsEditingGuests(true);
  };

  const cancelGuestEdit = () => {
    setGuestDraft(String(formData.guests));
    setIsEditingGuests(false);
  };

  const commitGuestEdit = () => {
    const parsed = Number.parseInt(guestDraft, 10);
    const safeValue = Number.isFinite(parsed)
      ? Math.min(20, Math.max(1, parsed))
      : formData.guests;
    updateFormData({ guests: safeValue });
    setIsEditingGuests(false);
  };

  return (
    <div
      className="h-[100dvh] overflow-y-auto text-zinc-900"
      style={{
        backgroundColor: SIAM_PALETTE.primary,
        color: SIAM_PALETTE.text,
      }}
    >


      <svg
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        aria-hidden="true"
      >
        <filter id="film-noise">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-noise)" />
      </svg>

      <div ref={bannerRef} className="fixed inset-x-0 top-0 z-50 border-b border-black/10 bg-[#A3B18A] px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="text-center lg:text-left">
            {bannerData?.text && <p className="text-xs font-medium text-zinc-900 sm:text-sm">{bannerData.text}{bannerData.link && <Link href={bannerData.link} target="_blank" rel="noopener noreferrer" className="ml-2 underline">{bannerData.linkText || 'Details'}</Link>}</p>}
            <button id="promotion-opener" type="button" onClick={() => setShowPromotion(true)} className="mt-1 text-xs font-semibold text-zinc-900 underline underline-offset-4">Monthly offers</button>
          </div>
          <div className="mx-auto w-full max-w-lg lg:mx-0"><EmailSignup source="banner" compact /></div>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 z-40 px-4"
        style={{ top: `${bannerHeight + 16}px` }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mx-auto w-full md:w-auto inline-flex items-center gap-4 rounded-full border border-black/10 bg-white/85 backdrop-blur-xl px-5 py-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)]">
            <div
              className="flex items-center gap-2 font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              <Utensils className="w-4 h-4" />
              <span>{restaurant.shortName}</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm text-zinc-700">
              <button
                type="button"
                onClick={() => setIsReserveOpen(true)}
                className="hover:text-zinc-950"
              >
                Reserve
              </button>
              <Link href="/menu" className="hover:text-zinc-950">
                Menu
              </Link>
              <Link href="/cater" className="hover:text-zinc-950">
                Catering
              </Link>
              <a
                href={restaurant.orderUrl}
                className="inline-flex items-center gap-1 hover:text-zinc-950"
                target="_blank"
                rel="noreferrer"
              >
                <ShoppingBag className="w-4 h-4" />
                Order Online
              </a>
            </div>
            <MagneticButton
              onClick={openReserveModal}
              className="group ml-auto rounded-full px-4 py-2 text-sm font-medium text-zinc-900"
              style={
                { backgroundColor: SIAM_PALETTE.accent } as React.CSSProperties
              }
            >
              Reserve Now
            </MagneticButton>
          </div>
        </div>
      </nav>

      <section className="relative min-h-[100dvh] overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={HERO_VIDEO}
          autoPlay
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/40 to-black/20" />
        <div style={{ paddingTop: `${bannerHeight + 120}px` }} className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pb-24 min-h-[100dvh] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 items-end">
          <div>
            <p
              className="text-zinc-100/85 text-sm md:text-base tracking-[0.14em] uppercase mb-4"
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              {restaurant.shortName} · {restaurant.location}
            </p>
            <h1 className="text-4xl md:text-6xl leading-none tracking-tight text-white">
              <span
                style={{ fontFamily: "var(--font-sans), sans-serif", fontWeight: 600 }}
              >
                Flavor is the
              </span>{" "}
              <span
                style={{
                  fontFamily: "var(--font-display), serif",
                  fontStyle: "italic",
                }}
              >
                Atmosphere.
              </span>
            </h1>
            <p
              className="mt-6 max-w-[60ch] text-zinc-100/85 text-base leading-relaxed"
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              {restaurant.tagline}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MagneticButton
                onClick={openReserveModal}
                className="group rounded-full px-6 py-3 text-sm font-semibold text-zinc-900"
                style={
                  {
                    backgroundColor: SIAM_PALETTE.accent,
                  } as React.CSSProperties
                }
              >
                Reserve Now
              </MagneticButton>
              <Link
                href="/menu"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                View Menu
              </Link>
              <Link
                href="/cater"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                Catering
              </Link>
              <a
                href={restaurant.orderUrl}
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                target="_blank"
                rel="noreferrer"
              >
                <ShoppingBag className="w-4 h-4" />
                Order Online
              </a>
            </div>

            {/* Mobile-only: inline pill chips */}
            <div className="mt-6 flex flex-wrap gap-2 md:hidden">
              {PILLARS.map((pillar) => (
                <span
                  key={pillar}
                  className="rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-white/90 tracking-wide"
                  style={{
                    fontFamily: "var(--font-editorial), serif",
                    fontSize: "0.85rem",
                  }}
                >
                  {pillar}
                </span>
              ))}
            </div>
          </div>

          {/* Desktop-only: stacked glass cards */}
          <div className="hidden md:grid grid-cols-1 gap-3 md:justify-self-end w-full md:max-w-md">
            {PILLARS.map((pillar) => (
              <div
                key={pillar}
                className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-4 py-3 text-white"
              >
                <div
                  className="mt-1 text-lg"
                  style={{ fontFamily: "var(--font-editorial), serif" }}
                >
                  {pillar}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="relative z-10 bg-[#F9F7F2] px-5 py-4 text-center text-xs text-zinc-600"><Link href="/privacy" className="underline">Privacy & email preferences</Link><span className="mx-3">·</span><a href={`mailto:${restaurant.email}`} className="underline">Contact us</a></div>
      <PromotionModal blocked={isReserveOpen || showTrending} manuallyOpen={showPromotion} onClose={() => setShowPromotion(false)} />

      {/* Floating LIVE / Closed trending button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.4 }}
        onClick={() => setShowTrending(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-white border border-zinc-200 px-4 py-2.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
        style={{ fontFamily: "var(--font-sans), sans-serif" }}
      >
        {isRestaurantOpen ? (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-red-500">
              Open
            </span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-zinc-400" />
            </span>
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-400">
              {isRestaurantOpen === null ? 'Checking hours' : 'Closed'}
            </span>
          </>
        )}
        <div className="h-3 w-px bg-zinc-200" />
        <span className="text-xs font-medium text-zinc-700">
          Menu highlights
        </span>
      </motion.button>

      {/* Trending modal */}
      <AnimatePresence>
        {showTrending && (
          <TrendingModal onClose={() => setShowTrending(false)} isOpen={isRestaurantOpen ?? false} />
        )}
      </AnimatePresence>

      <DialogPrimitive.Root open={isReserveOpen} onOpenChange={open => { if (!open) closeReserveModal(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
          <DialogPrimitive.Content ref={reservePanelRef}
            onEscapeKeyDown={event => { if (isSubmitting) event.preventDefault(); }}
            onPointerDownOutside={event => { if (isSubmitting) event.preventDefault(); }}
            onCloseAutoFocus={event => { event.preventDefault(); openerRef.current?.focus(); }}
            className="guest-management fixed inset-4 md:inset-10 z-50 max-w-4xl mx-auto overflow-auto rounded-[2rem] bg-white border shadow-xl p-6 md:p-8">
            <DialogPrimitive.Description className="sr-only">Request a table using the restaurant&apos;s local calendar and time. {policy?.autoConfirmReservations === false ? 'The restaurant must accept your request.' : 'Available reservations are confirmed when submitted.'}</DialogPrimitive.Description>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">
                  Reserve Now
                </p>
                <DialogPrimitive.Title asChild><h3
                  className="text-2xl md:text-3xl tracking-tight"
                  style={{ fontFamily: "var(--font-editorial), serif" }}
                >
                  {showReservationSuccess
                    ? (receipt?.status === 'confirmed' ? "Reservation confirmed" : "Reservation saved")
                    : (policy?.autoConfirmReservations === false ? "Request a table" : "Reserve a table")}
                </h3></DialogPrimitive.Title>
              </div>
              <button
                onClick={closeReserveModal} disabled={isSubmitting} aria-label="Close reservation form"
                className="rounded-full p-2 hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!showReservationSuccess && (
              <ProgressBar
                currentStep={step}
                steps={steps}
                onStepClick={(index) => { if (!isSubmitting) setStep(index); }}
              />
            )}

            <div className="mt-8">
              {showReservationSuccess ? (
                <div className="max-w-xl mx-auto text-center py-10">
                  <div
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                    style={{ backgroundColor: `${SIAM_PALETTE.accent}55` }}
                  >
                    <CheckCircle2
                      className="w-11 h-11"
                      style={{ color: SIAM_PALETTE.accent }}
                    />
                  </div>
                  {receipt && <ReservationReceipt details={receipt} />}
                  {managementLink && <a href={managementLink} className="mt-6 inline-block rounded-full border border-zinc-900/20 px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-[#F9F7F2]">Manage your reservation</a>}
                  <div className="mt-8 flex justify-center">
                    <MagneticButton
                      onClick={closeReserveModal}
                      className="group rounded-full px-7 py-2.5 text-sm font-semibold text-zinc-900"
                      style={
                        {
                          backgroundColor: SIAM_PALETTE.accent,
                        } as React.CSSProperties
                      }
                    >
                      Done
                    </MagneticButton>
                  </div>
                </div>
              ) : step === 0 ? (
                <div className="space-y-6">
                  <DatePicker
                    date={formData.date}
                    time={formData.time}
                    onUpdate={handleDateTimeUpdate}
                    onDateChange={handleDateChange}
                    availableTimeSlots={availableTimeSlots}
                    specialDates={specialDates}
                  />
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Party Size
                    </label>
                    <div className="flex items-center justify-between w-full px-2 py-2 border border-zinc-300 rounded-lg bg-white">
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingGuests) commitGuestEdit();
                          updateFormData({
                            guests: Math.max(1, formData.guests - 1),
                          });
                        }}
                        className="w-10 h-10 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                        disabled={formData.guests <= 1}
                        aria-label="Decrease party size"
                      >
                        -
                      </button>
                      {isEditingGuests ? (
                        <div className="text-center min-w-[92px]">
                          <input
                            ref={guestInputRef}
                            type="number"
                            min={1}
                            max={20}
                            value={guestDraft}
                            onChange={(e) =>
                              setGuestDraft(
                                e.target.value
                                  .replace(/[^\d]/g, "")
                                  .slice(0, 2),
                              )
                            }
                            onBlur={commitGuestEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitGuestEdit();
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                cancelGuestEdit();
                              }
                            }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-20 text-center text-xl font-semibold text-zinc-900 border border-zinc-300 rounded-md py-1 focus:outline-none focus:ring-2"
                            style={{
                              ["--tw-ring-color" as string]:
                                SIAM_PALETTE.accent,
                            }}
                            aria-label="Party size"
                          />
                          <div className="text-xs text-zinc-500 mt-1">
                            guests
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startGuestEdit}
                          className="text-center min-w-[92px] rounded-md px-2 py-1.5 hover:bg-zinc-50"
                          aria-label="Edit party size"
                        >
                          <div className="text-xl font-semibold text-zinc-900">
                            {formData.guests}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {formData.guests === 1 ? "guest" : "guests"}
                          </div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingGuests) commitGuestEdit();
                          updateFormData({
                            guests: Math.min(20, formData.guests + 1),
                          });
                        }}
                        className="w-10 h-10 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                        disabled={formData.guests >= 20}
                        aria-label="Increase party size"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Late cancellations and no-shows greatly impact our small
                    team. We reserve the right to decline future bookings for
                    accounts with multiple missed reservations.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <GuestInfo
                    formData={formData}
                    onUpdate={(data: Partial<ReservationData>) =>
                      updateFormData(data)
                    }
                    phoneVerified={phoneVerified}
                    onPhoneVerified={setPhoneVerified}
                    smsOptIn={smsOptIn}
                    onSmsOptIn={setSmsOptIn}
                    restaurantName={restaurant.name}
                    otpEnabled={otpEnabled}
                    disabled={isSubmitting || Boolean(policyError) || !policy}
                  />
                  <AdditionalInfo
                    comments={formData.comments}
                    onUpdate={updateFormData}
                    disabled={isSubmitting || Boolean(policyError) || !policy}
                  />
                </div>
              )}
            </div>

            {!showReservationSuccess && (
              <div className="mt-8 flex justify-between">
                {step > 0 && (
                  <button
                    onClick={prevStep} disabled={isSubmitting}
                    className="flex items-center px-4 py-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 active:scale-[0.98] transition-transform"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </button>
                )}
                {step < steps.length - 1 ? (
                  <MagneticButton
                    onClick={handleContinue}
                    className="group ml-auto rounded-full px-6 py-2 text-sm font-medium text-zinc-900"
                    style={
                      {
                        backgroundColor: SIAM_PALETTE.accent,
                      } as React.CSSProperties
                    }
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 inline ml-1" />
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    onClick={handleSubmit}
                    className="group ml-auto rounded-full px-6 py-2 text-sm font-medium text-zinc-900"
                    style={
                      {
                        backgroundColor: SIAM_PALETTE.accent,
                      } as React.CSSProperties
                    }
                    disabled={isSubmitting || Boolean(policyError) || !policy}
                  >
                    <span className="inline-flex items-center gap-2">
                      {isSubmitting && (
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                      )}
                      {policy?.autoConfirmReservations === false ? 'Request Table' : 'Reserve Table'}
                    </span>
                  </MagneticButton>
                )}
              </div>
            )}
            {!showReservationSuccess && (modalValidationError || policyError) && (
              <p role="alert" className="mt-4 text-sm text-red-600">
                {modalValidationError || policyError}
              </p>
            )}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}

export default App;
