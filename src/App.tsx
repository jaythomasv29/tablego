import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import Link from 'next/link';
import DatePicker from './components/DatePicker';
import GuestInfo from './components/GuestInfo';
import AdditionalInfo from './components/AdditionalInfo';
import ProgressBar from './components/ProgressBar';
import { useTimezone } from './contexts/TimezoneContext';
import { getDateInTimezone } from './utils/dateUtils';
import { gsap } from 'gsap';
import { db } from './firebase';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { TimeSlot } from './types/TimeSlot';

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
  time: '19:00',
  guests: 2,
  name: '',
  email: '',
  phone: '',
  comments: '',
};

// interface TimeSlot {
//   time: string;
// }

// Add SpecialDate interface
interface SpecialDate {
  date: string;
  reason: string;
  closureType?: 'full' | 'lunch' | 'dinner';
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

const TAGLINE = 'Thai & Pan-Asian Flavors in the heart of Palo Alto.';
const PILLARS = ['Wok-Fired', 'Family Friendly', 'Fresh Ingredients'];
const SIAM_PALETTE = {
  primary: '#F9F7F2',
  accent: '#A3B18A',
  surface: '#EAE0D5',
  text: '#121212',
};
const HERO_VIDEO = '/images/slow-mo-hero.mp4';

function MagneticButton({
  children,
  className,
  onClick,
  style,
  disabled = false,
  type = 'button',
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
  style?: React.CSSProperties;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    el.style.transform = `translate(${x * 0.08}px, ${y * 0.08}px) scale(1.05)`;
  };

  const handleLeave = () => {
    const el = buttonRef.current;
    if (!el) return;
    el.style.transform = 'translate(0px, 0px) scale(1)';
  };

  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={onClick}
      style={style}
      disabled={disabled}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative overflow-hidden transition-transform duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${className || ''}`}
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 group-hover:translate-x-full" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}

function App() {
  const { timezone, loading: timezoneLoading } = useTimezone();
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<ReservationData>(initialData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState<TimeSlot[]>([]);
  const [reservationCutoffMinutes, setReservationCutoffMinutes] = useState(60);
  const [isReserveOpen, setIsReserveOpen] = useState(false);
  const [showReservationSuccess, setShowReservationSuccess] = useState(false);
  const [modalValidationError, setModalValidationError] = useState<string | null>(null);
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const [isEditingGuests, setIsEditingGuests] = useState(false);
  const [guestDraft, setGuestDraft] = useState('2');
  const reservePanelRef = useRef<HTMLDivElement | null>(null);
  const guestInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isReserveOpen) return;
    const panel = reservePanelRef.current;
    if (!panel) return;

    gsap.fromTo(
      panel,
      { opacity: 0, scale: 1.1 },
      { opacity: 1, scale: 1, duration: 0.6, ease: 'power4.out' }
    );
  }, [isReserveOpen]);

  useEffect(() => {
    document.body.style.overflow = isReserveOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isReserveOpen]);

  useEffect(() => {
    const fetchBannerData = async () => {
      try {
        const bannerDoc = await getDoc(doc(db, 'settings', 'banner'));
        if (bannerDoc.exists() && bannerDoc.data().text) {
          setBannerData(bannerDoc.data() as BannerData);
        } else {
          setBannerData(null);
        }
      } catch (error) {
        console.error('Error fetching banner data:', error);
        setBannerData(null);
      }
    };

    fetchBannerData();
  }, []);

  useEffect(() => {
    const fetchReservationSettings = async () => {
      try {
        const [hoursDoc, generalDoc, specialDatesSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'businessHours')),
          getDoc(doc(db, 'settings', 'general')),
          getDocs(collection(db, 'specialDates')),
        ]);

        if (hoursDoc.exists()) {
          setBusinessHours(hoursDoc.data() as BusinessHours);
        }

        if (generalDoc.exists()) {
          const data = generalDoc.data();
          if (typeof data.reservationCutoffMinutes === 'number') {
            setReservationCutoffMinutes(data.reservationCutoffMinutes);
          }
        }

        setSpecialDates(specialDatesSnap.docs.map((d) => d.data() as SpecialDate));
      } catch (error) {
        console.error('Error loading reservation settings:', error);
      }
    };

    fetchReservationSettings();
  }, []);

  useEffect(() => {
    if (!timezoneLoading && timezone) {
      const restaurantToday = getDateInTimezone(new Date(), timezone);
      setFormData(prev => ({
        ...prev,
        date: restaurantToday
      }));
    }
  }, [timezone, timezoneLoading]);

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

  const generateTimeSlots = (date: Date, hours: BusinessHours): TimeSlot[] => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = days[date.getDay()];
    const dayHours = hours[dayOfWeek];
    if (!dayHours) return [];

    const specialDateForDay = specialDates.find((specialDate) => {
      const holidayDate = new Date(specialDate.date);
      return holidayDate.getMonth() === date.getMonth() && holidayDate.getDate() === date.getDate();
    });
    const closureType = specialDateForDay?.closureType || (specialDateForDay ? 'full' : null);
    const lunchClosedBySpecialDate = closureType === 'full' || closureType === 'lunch';
    const dinnerClosedBySpecialDate = closureType === 'full' || closureType === 'dinner';

    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const currentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : 0;
    const slotDuration = 30;

    const timeToMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    const minutesToTime = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
      return `${displayHours}:${mins.toString().padStart(2, '0')} ${period}`;
    };

    const pushRangeSlots = (start: number, end: number, period: 'lunch' | 'dinner') => {
      let adjustedStart = start;
      if (isToday && adjustedStart < currentMinutes) {
        adjustedStart = Math.ceil((currentMinutes + 30) / slotDuration) * slotDuration;
      }

      for (let time = adjustedStart; time <= end - reservationCutoffMinutes; time += slotDuration) {
        if (!isToday || time >= currentMinutes + 30) {
          slots.push({ time: minutesToTime(time), period });
        }
      }
    };

    if (dayHours.lunch.isOpen && !lunchClosedBySpecialDate) {
      if (dayHours.lunch.customRanges?.length) {
        dayHours.lunch.customRanges.forEach((range) => {
          const start = timeToMinutes(range.start);
          const end = timeToMinutes(range.end);
          if (!(isToday && end <= currentMinutes + reservationCutoffMinutes)) {
            pushRangeSlots(start, end, 'lunch');
          }
        });
      } else {
        pushRangeSlots(timeToMinutes(dayHours.lunch.open), timeToMinutes(dayHours.lunch.close), 'lunch');
      }
    }

    if (dayHours.dinner.isOpen && !dinnerClosedBySpecialDate) {
      if (dayHours.dinner.customRanges?.length) {
        dayHours.dinner.customRanges.forEach((range) => {
          const start = timeToMinutes(range.start);
          const end = timeToMinutes(range.end);
          if (!(isToday && end <= currentMinutes + reservationCutoffMinutes)) {
            pushRangeSlots(start, end, 'dinner');
          }
        });
      } else {
        pushRangeSlots(timeToMinutes(dayHours.dinner.open), timeToMinutes(dayHours.dinner.close), 'dinner');
      }
    }

    const sortTime = (timeStr: string) => {
      const [time, period] = timeStr.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };

    return slots.sort((a, b) => sortTime(a.time) - sortTime(b.time));
  };

  useEffect(() => {
    if (!businessHours) return;
    const slots = generateTimeSlots(formData.date, businessHours);
    setAvailableTimeSlots(slots);
    if (formData.time && !slots.some((slot) => slot.time === formData.time)) {
      setFormData((prev) => ({ ...prev, time: '' }));
    }
  }, [formData.date, businessHours, reservationCutoffMinutes, specialDates]);

  const steps = [
    { title: 'Date & Time', icon: Calendar },
    { title: 'Guest Details', icon: Users },
  ];

  const updateFormData = (data: Partial<ReservationData>) => {
    setModalValidationError(null);
    setFormData(prev => ({
      ...prev,
      ...data
    }));
  };

  const nextStep = () => setStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));
  const openReserveModal = () => {
    setShowReservationSuccess(false);
    setModalValidationError(null);
    setIsReserveOpen(true);
  };
  const closeReserveModal = () => {
    setIsReserveOpen(false);
    setShowReservationSuccess(false);
    setModalValidationError(null);
    setStep(0);
  };

  const isStepOneValid = () => Boolean(formData.date && formData.time && formData.guests > 0);
  const isStepTwoValid = () => {
    const phoneDigits = formData.phone.replace(/\D/g, '');
    return Boolean(
      formData.name.trim() &&
      formData.email.trim() &&
      phoneDigits.length === 10
    );
  };

  const handleContinue = () => {
    if (!isStepOneValid()) {
      setModalValidationError('Please select date, time, and guest count before continuing.');
      return;
    }
    setModalValidationError(null);
    nextStep();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    if (!isStepTwoValid()) {
      setModalValidationError('Please complete name, email, and phone before confirming.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/send-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData: {
            ...formData,
            date: formData.date instanceof Date ? formData.date.toISOString() : formData.date,
          },
          timezone: timezone || 'America/Los_Angeles',
        }),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to process reservation');
      }

      setModalValidationError(null);
      setShowReservationSuccess(true);
    } catch (error) {
      console.error('Reservation submission failed:', error);
      setModalValidationError('Unable to complete reservation right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDateChange = (date: Date) => {
    const dateInTimezone = getDateInTimezone(date, timezone);
    setFormData((prev) => ({ ...prev, date: dateInTimezone }));
  };

  const handleDateTimeUpdate = (date: Date, time: string) => {
    setModalValidationError(null);
    setFormData(prev => ({ ...prev, date, time }));
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
    const safeValue = Number.isFinite(parsed) ? Math.min(20, Math.max(1, parsed)) : formData.guests;
    updateFormData({ guests: safeValue });
    setIsEditingGuests(false);
  };

  return (
    <div
      className="h-[100dvh] overflow-hidden text-zinc-900"
      style={{ backgroundColor: SIAM_PALETTE.primary, color: SIAM_PALETTE.text }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,600;1,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <svg className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]" aria-hidden="true">
        <filter id="film-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-noise)" />
      </svg>

      {bannerData?.text && (
        <div
          className="fixed top-0 inset-x-0 z-50 h-[50px] w-full flex items-center justify-center px-4"
          style={{ backgroundColor: SIAM_PALETTE.accent }}
        >
          <p className="text-zinc-900 text-center text-sm md:text-base font-medium">
            {bannerData.text}
            {bannerData.link && (
              <>
                {' '}
                <Link
                  href={bannerData.link}
                  className="underline hover:text-zinc-700 transition-colors ml-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {bannerData.linkText || 'Learn More'}
                </Link>
              </>
            )}
          </p>
        </div>
      )}

      <nav
        className="fixed inset-x-0 z-40 px-4"
        style={{ top: bannerData?.text ? '68px' : '24px' }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mx-auto w-full md:w-auto inline-flex items-center gap-4 rounded-full border border-black/10 bg-white/85 backdrop-blur-xl px-5 py-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)]">
            <div className="flex items-center gap-2 font-semibold tracking-tight" style={{ fontFamily: 'Inter, sans-serif' }}>
              <Utensils className="w-4 h-4" />
              <span>Thaiphoon</span>
            </div>
            <div className="hidden md:flex items-center gap-4 text-sm text-zinc-700">
              <button type="button" onClick={() => setIsReserveOpen(true)} className="hover:text-zinc-950">
                Reserve
              </button>
              <Link href="/menu" className="hover:text-zinc-950">
                Menu
              </Link>
              <a
                href="https://order.online/business/Thaiphoon-450?utm_source=sdk&visitorId=193be2bc7cf1d9e9c"
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
              style={{ backgroundColor: SIAM_PALETTE.accent } as React.CSSProperties}
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
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-36 md:pt-44 pb-16 min-h-[100dvh] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 items-end">
          <div>
            <p className="text-zinc-100/85 text-sm md:text-base tracking-[0.14em] uppercase mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Thaiphoon · Palo Alto
            </p>
            <h1 className="text-4xl md:text-6xl leading-none tracking-tight text-white">
              <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>Flavor is the</span>{' '}
              <span style={{ fontFamily: 'Playfair Display, serif', fontStyle: 'italic' }}>Atmosphere.</span>
            </h1>
            <p className="mt-6 max-w-[60ch] text-zinc-100/85 text-base leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              {TAGLINE}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MagneticButton
                onClick={openReserveModal}
                className="group rounded-full px-6 py-3 text-sm font-semibold text-zinc-900"
                style={{ backgroundColor: SIAM_PALETTE.accent } as React.CSSProperties}
              >
                Reserve Now
              </MagneticButton>
              <Link href="/menu" className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                View Menu
              </Link>
              <a
                href="https://order.online/business/Thaiphoon-450?utm_source=sdk&visitorId=193be2bc7cf1d9e9c"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors inline-flex items-center gap-2"
                target="_blank"
                rel="noreferrer"
              >
                <ShoppingBag className="w-4 h-4" />
                Order Online
              </a>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:justify-self-end w-full md:max-w-md">
            {PILLARS.map((pillar) => (
              <div key={pillar} className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md px-4 py-3 text-white">
                {/* <div className="text-xs uppercase tracking-[0.12em] text-white/70">Experience Pillar</div> */}
                <div className="mt-1 text-lg" style={{ fontFamily: 'Cormorant Garamond, serif' }}>{pillar}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {isReserveOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-2xl p-4 md:p-10" onClick={closeReserveModal}>
          <div
            ref={reservePanelRef}
            className="max-w-4xl mx-auto h-full overflow-auto rounded-[2rem] bg-white/85 border border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_24px_60px_-28px_rgba(0,0,0,0.45)] p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-xs uppercase tracking-[0.12em] text-zinc-500">Reserve Now</p>
                <h3 className="text-2xl md:text-3xl tracking-tight" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {showReservationSuccess ? 'Reservation Confirmed' : 'Confirm your table'}
                </h3>
              </div>
              <button onClick={closeReserveModal} className="rounded-full p-2 hover:bg-zinc-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!showReservationSuccess && (
              <ProgressBar currentStep={step} steps={steps} onStepClick={(index) => setStep(index)} />
            )}

            <div className="mt-8">
              {showReservationSuccess ? (
                <div className="max-w-xl mx-auto text-center py-10">
                  <div
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                    style={{ backgroundColor: `${SIAM_PALETTE.accent}55` }}
                  >
                    <CheckCircle2 className="w-11 h-11" style={{ color: SIAM_PALETTE.accent }} />
                  </div>
                  <h4 className="text-2xl font-semibold text-zinc-900" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    Your table request is in
                  </h4>
                  <p className="mt-3 text-zinc-600 leading-relaxed">
                    Thank you, {formData.name || 'guest'}. We are preparing your reservation details and will follow up by email shortly.
                  </p>
                  <div
                    className="mt-6 rounded-2xl border p-4 text-sm text-zinc-700"
                    style={{ borderColor: `${SIAM_PALETTE.accent}66`, backgroundColor: `${SIAM_PALETTE.accent}22` }}
                  >
                    {formData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {formData.time || '—'} · {formData.guests} {formData.guests === 1 ? 'guest' : 'guests'}
                  </div>
                  <div className="mt-8 flex justify-center">
                    <MagneticButton
                      onClick={closeReserveModal}
                      className="group rounded-full px-7 py-2.5 text-sm font-semibold text-zinc-900"
                      style={{ backgroundColor: SIAM_PALETTE.accent } as React.CSSProperties}
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
                          updateFormData({ guests: Math.max(1, formData.guests - 1) });
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
                            onChange={(e) => setGuestDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                            onBlur={commitGuestEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitGuestEdit();
                              } else if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelGuestEdit();
                              }
                            }}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            className="w-20 text-center text-xl font-semibold text-zinc-900 border border-zinc-300 rounded-md py-1 focus:outline-none focus:ring-2"
                            style={{ ['--tw-ring-color' as string]: SIAM_PALETTE.accent }}
                            aria-label="Party size"
                          />
                          <div className="text-xs text-zinc-500 mt-1">guests</div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={startGuestEdit}
                          className="text-center min-w-[92px] rounded-md px-2 py-1.5 hover:bg-zinc-50"
                          aria-label="Edit party size"
                        >
                          <div className="text-xl font-semibold text-zinc-900">{formData.guests}</div>
                          <div className="text-xs text-zinc-500">{formData.guests === 1 ? 'guest' : 'guests'}</div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingGuests) commitGuestEdit();
                          updateFormData({ guests: Math.min(20, formData.guests + 1) });
                        }}
                        className="w-10 h-10 rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                        disabled={formData.guests >= 20}
                        aria-label="Increase party size"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Late cancellations and no-shows greatly impact our small team. We reserve the right to decline future bookings for accounts with multiple missed reservations.
                  </p>
                </div>
              ) : (
                <div className="space-y-8">
                  <GuestInfo formData={formData} onUpdate={(data: Partial<ReservationData>) => updateFormData(data)} />
                  <AdditionalInfo comments={formData.comments} onUpdate={updateFormData} />
                </div>
              )}
            </div>

            {!showReservationSuccess && (
              <div className="mt-8 flex justify-between">
                {step > 0 && (
                  <button
                    onClick={prevStep}
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
                    style={{ backgroundColor: SIAM_PALETTE.accent } as React.CSSProperties}
                  >
                    Continue
                    <ChevronRight className="w-4 h-4 inline ml-1" />
                  </MagneticButton>
                ) : (
                  <MagneticButton
                    onClick={handleSubmit}
                    className="group ml-auto rounded-full px-6 py-2 text-sm font-medium text-zinc-900"
                    style={{ backgroundColor: SIAM_PALETTE.accent } as React.CSSProperties}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="inline-block w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                        Confirming...
                      </span>
                    ) : (
                      'Confirm Table'
                    )}
                  </MagneticButton>
                )}
              </div>
            )}
            {!showReservationSuccess && modalValidationError && (
              <p className="mt-4 text-sm text-red-600">{modalValidationError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;