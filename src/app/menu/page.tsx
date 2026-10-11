"use client";

import { useBusinessPolicy } from '@/components/reservations/useBusinessPolicy';
import { openAt } from '@/lib/reservations/availability';
import MenuImage from '@/components/menu/MenuImage';
import { useTimezone } from '@/contexts/TimezoneContext';
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Download, Share2, Utensils } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  addDoc,
  collection,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/firebase";
import dynamic from "next/dynamic";

const TrendingModal = dynamic(() => import("@/components/TrendingModal").then(module => module.TrendingModal), {
  ssr: false, loading: () => <p role="status" className="fixed bottom-4 left-4 z-50 rounded bg-white p-4 text-zinc-900">Loading menu highlights…</p>,
});

const ACCENT = "#A3B18A";

const CATEGORY_ORDER = [
  "Appetizers",
  "Soup",
  "Salad",
  "Signature Dishes",
  "Wok",
  "Curry",
  "Noodles",
  "Fried Rice",
  "Grill",
  "Sides",
  "Desserts",
];

// ─── MenuItem interface ───────────────────────────────────────────────────────

interface MenuItem {
  id?: string;
  name: string;
  price?: number;
  description: string;
  category: string;
  imageUrl: string;
}

function categoryId(cat: string) {
  return `cat-${cat.toLowerCase().replace(/\s+/g, "-")}`;
}

// ─── MenuPage ─────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const { restaurant } = useTimezone();
  const { policy } = useBusinessPolicy();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuError, setMenuError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(
    CATEGORY_ORDER[0],
  );
  const [shareLabel, setShareLabel] = useState("");
  const [showTrending, setShowTrending] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    try { setIsOpen(policy ? openAt(policy) : null); } catch { setIsOpen(null); }
  }, [policy, tick]);

  // Re-check every minute
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const trackEvent = async (type: "download" | "share") => {
    try {
      await addDoc(collection(db, "menuDownloads"), {
        type,
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      console.error("Failed to track menu event:", e);
    }
  };

  const handleDownload = async () => {
    await trackEvent("download");
    const a = document.createElement("a");
    a.href = restaurant.menuPdf;
    a.download = `${restaurant.shortName} Menu.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    const pdfUrl = window.location.origin + restaurant.menuPdf;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${restaurant.name} Menu`,
          url: pdfUrl,
        });
        await trackEvent("share");
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(pdfUrl);
      await trackEvent("share");
      setShareLabel("Copied!");
      setTimeout(() => setShareLabel(""), 2000);
    }
  };

  useEffect(() => {
    return onSnapshot(collection(db, 'menu'), snapshot => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))); setLoading(false);
    }, () => { setLoading(false); setMenuError('Menu could not be loaded. Please refresh or call the restaurant.'); });
  }, []);

  // Track active category via IntersectionObserver
  useEffect(() => {
    if (loading) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const cat = CATEGORY_ORDER.find((c) => categoryId(c) === id);
          if (cat) setActiveCategory(cat);
        }
      },
      { rootMargin: "-10% 0px -70% 0px", threshold: 0 },
    );
    CATEGORY_ORDER.forEach((cat) => {
      const el = document.getElementById(categoryId(cat));
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [loading]);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const el = document.getElementById(categoryId(cat));
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: menuItems.filter((item) => item.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div
      className="min-h-screen text-zinc-900"
      style={{ backgroundColor: "transparent" }}
    >


      {/* Film noise */}
      <svg
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        aria-hidden="true"
      >
        <filter id="film-noise-menu">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#film-noise-menu)" />
      </svg>

      {/* Fixed video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/images/slow-mo-hero.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-black/65 via-black/40 to-black/10" />

      {/* Navbar */}
      <nav className="fixed inset-x-0 top-6 z-40 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="inline-flex items-center gap-4 rounded-full border border-black/10 bg-white/85 backdrop-blur-xl px-5 py-3 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)]">
            <div
              className="flex items-center gap-2 font-semibold tracking-tight text-zinc-900"
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              <Utensils className="w-4 h-4" />
              <span>{restaurant.shortName}</span>
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <Link
              href="/"
              className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Reserve
            </Link>
            <Link
              href="/cater"
              className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Catering
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative h-[45vh] flex items-end pb-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full text-center text-white px-4"
        >
          <p
            className="text-xs uppercase tracking-[0.16em] text-white/60 mb-3"
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            {restaurant.shortName} · {restaurant.location}
          </p>
          <h1
            className="text-5xl md:text-6xl font-light text-white mb-3"
            style={{ fontFamily: "var(--font-editorial), serif" }}
          >
            Our Menu
          </h1>
          <p
            className="text-sm text-white/65 mb-6"
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            Thai &amp; Pan-Asian · Dine-in &amp; Takeout
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: ACCENT,
                fontFamily: "var(--font-sans), sans-serif",
              }}
            >
              <Download className="w-4 h-4" />
              Download Menu
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95"
              style={{ fontFamily: "var(--font-sans), sans-serif" }}
            >
              <Share2 className="w-4 h-4" />
              {shareLabel || "Share"}
            </button>
          </div>
        </motion.div>
      </section>

      {/* Menu body — rises over video */}
      <section className="relative z-10 bg-[#F9F7F2] rounded-t-[2rem] -mt-6 min-h-screen">
        {/* Sticky category pill strip */}
        <div className="sticky top-0 z-30 bg-[#F9F7F2]/95 backdrop-blur-sm border-b border-zinc-100">
          <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORY_ORDER.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className="rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
                  style={
                    isActive
                      ? { backgroundColor: ACCENT, color: "#121212" }
                      : {
                          border: "1px solid #d4d4d8",
                          color: "#71717a",
                          backgroundColor: "transparent",
                        }
                  }
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Menu content */}
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-16">
          {menuError && <p role="alert" className="my-4 text-red-700">{menuError}</p>}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div
                className="w-8 h-8 rounded-full border-2 border-zinc-200 animate-spin"
                style={{ borderTopColor: ACCENT }}
              />
              <p
                className="text-sm text-zinc-400"
                style={{ fontFamily: "var(--font-sans), sans-serif" }}
              >
                Loading menu…
              </p>
            </div>
          ) : !menuItems.length && !menuError ? <p className="py-12 text-center text-zinc-600">Our online menu is being updated. Please call {restaurant.phoneLabel} for current dishes.</p> : (
            grouped.map(({ category, items }) => (
              <div
                key={category}
                id={categoryId(category)}
                className="scroll-mt-20"
              >
                <div className="mb-6 flex items-center gap-5">
                  <h2
                    className="text-2xl font-light text-zinc-900 shrink-0"
                    style={{ fontFamily: "var(--font-editorial), serif" }}
                  >
                    {category}
                  </h2>
                  <div className="flex-1 h-px bg-zinc-200" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => {
                    const hasImage = !!item.imageUrl;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl bg-white border border-zinc-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${!hasImage ? "border-l-[3px]" : ""}`}
                        style={
                          !hasImage ? { borderLeftColor: ACCENT } : undefined
                        }
                      >
                        {hasImage && (
                          <MenuImage src={item.imageUrl} name={item.name} className="aspect-[4/3] w-full bg-zinc-50" />
                        )}
                        <div className="p-4">
                          <h3
                            className="font-medium text-zinc-900 text-[0.95rem] leading-snug mb-1.5"
                            style={{ fontFamily: "var(--font-sans), sans-serif" }}
                          >
                            {item.name}
                          </h3>
                          {item.description && (
                            <p
                              className="text-zinc-500 text-sm line-clamp-2"
                              style={{ fontFamily: "var(--font-sans), sans-serif" }}
                            >
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer strip */}
        <div className="border-t border-zinc-100 py-8 text-center">
          <p
            className="text-sm text-zinc-400"
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            {restaurant.name} · {restaurant.address} ·{" "}
            <a
              href={`tel:${restaurant.phone}`}
              className="hover:text-zinc-600 transition-colors"
            >
              {restaurant.phoneLabel}
            </a>
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Reserve a Table
            </Link>
            <span className="text-zinc-300">·</span>
            <Link
              href="/cater"
              className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
            >
              Catering Inquiry
            </Link>
          </div>
        </div>
      </section>

      {/* Floating LIVE / Closed trending button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        onClick={() => setShowTrending(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full bg-white border border-zinc-200 px-4 py-2.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 active:scale-95"
        style={{ fontFamily: "var(--font-sans), sans-serif" }}
      >
        {isOpen ? (
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
              {isOpen === null ? 'Checking hours' : 'Closed'}
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
          <TrendingModal onClose={() => setShowTrending(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
