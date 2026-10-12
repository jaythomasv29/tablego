'use client';
import MagneticButton from '@/components/MagneticButton';
import PhoneVerificationField from '@/components/PhoneVerificationField';
import { restaurantClock } from '@/lib/reservations/availability';
import { useTimezone } from '@/contexts/TimezoneContext';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ChevronDown, Utensils, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

const ACCENT = '#A3B18A';

interface MenuItem {
  id: string;
  name: string;
  category: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  eventType: string;
  date: string;
  partySize: string;
  budget: string;
  specialRequests: string;
}

const initialFormData: FormData = {
  name: '',
  email: '',
  phone: '',
  eventType: '',
  date: '',
  partySize: '',
  budget: '',
  specialRequests: '',
};


const EVENT_TYPES = ['Corporate', 'Wedding', 'Birthday', 'Private Party', 'Other'];

const DISH_CATEGORIES = [
  'Appetizers', 'Soup', 'Salad', 'Signature Dishes',
  'Wok', 'Curry', 'Noodles', 'Fried Rice', 'Grill', 'Sides',
];

const BUDGET_OPTIONS = [
  'Under $500',
  '$500 – $1,000',
  '$1,000 – $2,500',
  '$2,500 – $5,000',
  '$5,000+',
  'Not sure yet',
];

const inputClass =
  'w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white/70 focus:outline-none focus:ring-2 focus:border-[#A3B18A] text-zinc-900 placeholder:text-zinc-400 text-sm transition-all';
const labelClass = 'block text-xs font-medium text-zinc-500 uppercase tracking-wide mb-1.5';

export default function CateringPage() {
  const { restaurant, timezone } = useTimezone();
  const submissionRef = useRef<{ key: string; payload: string } | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedDishes, setSelectedDishes] = useState<MenuItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    getDocs(collection(db, 'menu')).then(snap => {
      setMenuItems(
        snap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          category: doc.data().category || '',
        }))
      );
    }).catch(err => console.error('Error fetching menu:', err));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleDish = (item: MenuItem) => {
    setSelectedDishes(prev =>
      prev.find(d => d.id === item.id)
        ? prev.filter(d => d.id !== item.id)
        : [...prev, item]
    );
  };

  const toggleCategory = (cat: string) => {
    setActiveCategory(prev => (prev === cat ? null : cat));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!phoneVerified) { setSubmitError('Verify your phone number before sending your inquiry.'); return; }
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = JSON.stringify({ formData: { ...formData, address: '', time: '', selectedDishes: selectedDishes.map(dish => ({ id: dish.id, name: dish.name })) } });
      if (submissionRef.current?.payload !== payload) submissionRef.current = { key: crypto.randomUUID(), payload };
      const response = await fetch('/api/send-proposal', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': submissionRef.current.key }, body: payload });
      const result = await response.json();
      if (response.status === 403) { setPhoneVerified(false); throw new Error(result.error || 'Please verify your phone number again.'); }
      if (!response.ok || !result.success) throw new Error(result.error || 'Your inquiry could not be saved.');
      submissionRef.current = null;

      setShowSuccess(true);
      setFormData(initialFormData);
      setPhoneVerified(false);
      setSelectedDishes([]);
      setActiveCategory(null);
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitError(error instanceof Error ? error.message : `Failed to send your inquiry. Please call us at ${restaurant.phoneLabel}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const today = restaurantClock(timezone).date;
  const firstName = formData.name.trim().split(' ')[0];

  return (
    <div className="min-h-[100dvh] text-zinc-900" style={{ backgroundColor: 'transparent' }}>


      {/* Film noise texture */}
      <svg className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]" aria-hidden="true">
        <filter id="film-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-noise)" />
      </svg>

      {/* Navbar */}
      <nav className="fixed inset-x-0 top-6 z-40 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-4 rounded-full border border-black/10 bg-white/85 backdrop-blur-xl px-5 py-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)]">
            <div
              className="flex items-center gap-2 font-semibold tracking-tight"
              style={{ fontFamily: 'var(--font-sans), sans-serif' }}
            >
              <Utensils className="w-4 h-4" />
              <span>{restaurant.shortName}</span>
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Reserve
            </Link>
            <Link href="/menu" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Menu
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero section */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/images/slow-mo-hero.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-r from-black/55 via-black/40 to-black/20" />

      <section className="relative min-h-[100dvh]">

        {/* Content grid */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-32 md:pt-36 pb-16 min-h-[100dvh] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-10 items-center">

          {/* Left column */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-white"
          >
            <p
              className="text-xs uppercase tracking-[0.14em] text-white/70 mb-4"
              style={{ fontFamily: 'var(--font-sans), sans-serif' }}
            >
              {restaurant.shortName} · {restaurant.location}
            </p>
            <h1
              className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight mb-4"
              style={{ fontFamily: 'var(--font-sans), sans-serif' }}
            >
              Bring the Wok{' '}
              <span className="italic font-normal" style={{ fontFamily: 'var(--font-display), serif' }}>
                to Your Event.
              </span>
            </h1>
            <p
              className="text-white/75 text-base md:text-lg leading-relaxed max-w-md mb-8"
              style={{ fontFamily: 'var(--font-sans), sans-serif' }}
            >
              Thai & Pan-Asian catering for corporate events, weddings, and private parties in the Bay Area.
            </p>
            <div className="flex flex-wrap gap-3">
              {['500+ Events Catered', '20 Years in Palo Alto', 'Bay Area Favorite'].map(stat => (
                <div
                  key={stat}
                  className="rounded-full border border-white/30 bg-white/10 backdrop-blur-sm px-4 py-2 text-white text-sm"
                  style={{ fontFamily: 'var(--font-sans), sans-serif' }}
                >
                  {stat}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right column — glass card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-[2rem] bg-white/85 border border-white/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_24px_60px_-28px_rgba(0,0,0,0.45)] backdrop-blur-xl p-6 md:p-8 w-full max-w-md md:ml-auto"
          >
            {showSuccess ? (
              <div className="text-center py-6">
                <div
                  className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
                  style={{ backgroundColor: `${ACCENT}33` }}
                >
                  <CheckCircle2 className="w-9 h-9" style={{ color: ACCENT }} />
                </div>
                <h3
                  className="text-2xl tracking-tight text-zinc-900 mb-2"
                  style={{ fontFamily: 'var(--font-editorial), serif' }}
                >
                  {firstName ? `We're on it, ${firstName}.` : "We're on it."}
                </h3>
                <p className="text-zinc-600 text-sm leading-relaxed mb-5">
                  Our team will reach out within 24 hours to discuss your event details and menu options.
                </p>
                <div
                  className="rounded-2xl p-4 text-sm text-zinc-700 mb-6"
                  style={{ backgroundColor: `${ACCENT}22`, borderColor: `${ACCENT}44`, border: '1px solid' }}
                >
                  For immediate inquiries, call{' '}
                  <a href={`tel:${restaurant.phone}`} className="font-semibold hover:underline">
                    {restaurant.phoneLabel}
                  </a>
                </div>
                <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
                  ← Back to {restaurant.shortName}
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2
                    className="text-2xl tracking-tight text-zinc-900"
                    style={{ fontFamily: 'var(--font-editorial), serif' }}
                  >
                    Catering Inquiry
                  </h2>
                  <p className="text-zinc-500 text-sm mt-1" style={{ fontFamily: 'var(--font-sans), sans-serif' }}>
                    We&apos;ll follow up within 24 hours.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Name */}
                  <div>
                    <label htmlFor="catering-name" className={labelClass}>Name</label>
                    <input
                      type="text"
                      id="catering-name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="Your full name"
                      className={inputClass}
                      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                    />
                  </div>

                  {/* Email */}
                  <div>
                      <label htmlFor="catering-email" className={labelClass}>Email</label>
                      <input
                        type="email"
                        id="catering-email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="you@email.com"
                        className={inputClass}
                        style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                      />
                  </div>

                  <PhoneVerificationField phone={formData.phone} verified={phoneVerified} onVerified={setPhoneVerified} disabled={isSubmitting}
                    onChange={phone => { setPhoneVerified(false); setSubmitError(''); setFormData(prev => ({ ...prev, phone })); }} />

                  {/* Event Type */}
                  <div>
                    <label className={labelClass}>Event Type</label>
                    <div className="flex flex-wrap gap-2">
                      {EVENT_TYPES.map(type => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, eventType: type }))}
                          className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                          style={
                            formData.eventType === type
                              ? { backgroundColor: ACCENT, color: '#121212' }
                              : { border: '1px solid #d4d4d8', color: '#71717a', backgroundColor: 'transparent' }
                          }
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date + Party Size */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="catering-date" className={labelClass}>Event Date</label>
                      <input
                        type="date"
                        id="catering-date"
                        name="date"
                        value={formData.date}
                        onChange={handleChange}
                        required
                        min={today}
                        className={inputClass}
                        style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                      />
                    </div>
                    <div>
                      <label htmlFor="catering-party-size" className={labelClass}>Party Size</label>
                      <input
                        type="number"
                        id="catering-party-size"
                        name="partySize"
                        value={formData.partySize}
                        onChange={handleChange}
                        required
                        min="1"
                        placeholder="# guests"
                        className={inputClass}
                        style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                      />
                    </div>
                  </div>

                  {/* Budget Range */}
                  <div>
                    <label htmlFor="catering-budget" className={labelClass}>Approximate Budget</label>
                    <select
                      id="catering-budget"
                      name="budget"
                      value={formData.budget}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                    >
                      <option value="" disabled>Select a range</option>
                      {BUDGET_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>

                  {/* Special Requests */}
                  <div>
                    <label htmlFor="catering-special-requests" className={labelClass}>
                      Special Requests <span className="normal-case text-zinc-400">(optional)</span>
                    </label>
                    <textarea
                      id="catering-special-requests"
                      name="specialRequests"
                      value={formData.specialRequests}
                      onChange={handleChange}
                      placeholder="Dietary restrictions, allergies, or anything else we should know?"
                      className={`${inputClass} min-h-[80px] resize-none`}
                      style={{ '--tw-ring-color': ACCENT } as React.CSSProperties}
                    />
                  </div>

                  {/* Menu Selection */}
                  <div>
                    <label className={labelClass}>
                      Build Your Menu <span className="normal-case text-zinc-400">(optional)</span>
                    </label>

                    {/* Category pills */}
                    <div className="flex flex-wrap gap-2 mb-2">
                      {DISH_CATEGORIES.map(cat => {
                        const count = selectedDishes.filter(d => d.category === cat).length;
                        const isActive = activeCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                            style={
                              isActive
                                ? { backgroundColor: ACCENT, color: '#121212' }
                                : count > 0
                                ? { backgroundColor: `${ACCENT}30`, color: '#3f3f46', border: `1px solid ${ACCENT}` }
                                : { border: '1px solid #d4d4d8', color: '#71717a', backgroundColor: 'transparent' }
                            }
                          >
                            {cat}
                            {count > 0 && (
                              <span
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold"
                                style={{ backgroundColor: isActive ? 'rgba(0,0,0,0.15)' : ACCENT, color: '#121212' }}
                              >
                                {count}
                              </span>
                            )}
                            <ChevronDown
                              className="w-3 h-3 transition-transform duration-200"
                              style={{ transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)' }}
                            />
                          </button>
                        );
                      })}
                    </div>

                    {/* Expanded dish list */}
                    <AnimatePresence>
                      {activeCategory && (
                        <motion.div
                          key={activeCategory}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: 'easeInOut' }}
                          className="overflow-hidden"
                        >
                          <div
                            className="mt-1 mb-2 rounded-2xl p-3"
                            style={{ backgroundColor: `${ACCENT}12`, border: `1px solid ${ACCENT}33` }}
                          >
                            {menuItems.filter(i => i.category === activeCategory).length === 0 ? (
                              <p className="text-xs text-zinc-400 text-center py-2">No items in this category yet.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {menuItems
                                  .filter(i => i.category === activeCategory)
                                  .map(item => {
                                    const picked = selectedDishes.some(d => d.id === item.id);
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => toggleDish(item)}
                                        className="rounded-full px-3 py-1.5 text-sm font-medium transition-all"
                                        style={
                                          picked
                                            ? { backgroundColor: ACCENT, color: '#121212' }
                                            : { border: '1px solid #d4d4d8', color: '#3f3f46', backgroundColor: 'white' }
                                        }
                                      >
                                        {item.name}
                                      </button>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Selected dishes summary */}
                    <AnimatePresence>
                      {selectedDishes.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18 }}
                          className="mt-2 rounded-2xl p-3"
                          style={{ backgroundColor: `${ACCENT}18`, border: `1px solid ${ACCENT}44` }}
                        >
                          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wide mb-2">
                            Selected · {selectedDishes.length} {selectedDishes.length === 1 ? 'item' : 'items'}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedDishes.map(dish => (
                              <span
                                key={dish.id}
                                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-zinc-800"
                                style={{ backgroundColor: `${ACCENT}40` }}
                              >
                                {dish.name}
                                <button
                                  type="button"
                                  onClick={() => toggleDish(dish)}
                                  className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Submit */}
                  <MagneticButton
                    type="submit"
                    disabled={isSubmitting || !formData.eventType || !phoneVerified}
                    className="group w-full rounded-full py-3.5 text-sm font-semibold text-zinc-900 mt-1"
                    style={{ backgroundColor: ACCENT }}
                  >
                    {isSubmitting ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-zinc-900/30 border-t-zinc-900 animate-spin" />
                        Sending inquiry…
                      </span>
                    ) : (
                      'Request a Catering Proposal'
                    )}
                  </MagneticButton>

                  {submitError && (
                    <p role="alert" className="text-sm text-red-600 text-center">{submitError}</p>
                  )}
                </form>
              </>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
