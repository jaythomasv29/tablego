"use client";

import { useBusinessPolicy } from '@/components/reservations/useBusinessPolicy';
import { openAt } from '@/lib/reservations/availability';
import MenuCanvas from '@/components/menu/MenuCanvas';
import { useTimezone } from '@/contexts/TimezoneContext';
import React, { useEffect, useState } from "react";
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

// ─── MenuPage ─────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const { restaurant } = useTimezone();
  const { policy } = useBusinessPolicy();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuError, setMenuError] = useState('');
  const [shareLabel, setShareLabel] = useState("");
  const [showTrending, setShowTrending] = useState(false);
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [tick, setTick] = useState(0);

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

  // Live item data powers the screen-reader / search text version of the menu.
  useEffect(() => {
    return onSnapshot(collection(db, 'menu'), snapshot => {
      setMenuItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem)));
    }, () => { setMenuError('Menu could not be loaded. Please refresh or call the restaurant.'); });
  }, []);

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: menuItems.filter((item) => item.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden text-zinc-900">
      {/* Fixed video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/images/slow-mo-hero.mp4"
      />
      <div className="fixed inset-0 -z-10 bg-black/60" />

      {/* Header */}
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-3 pb-3 pt-4 sm:px-6">
        <nav className="flex items-center gap-4 rounded-full border border-black/10 bg-white/85 px-5 py-2.5 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)] backdrop-blur-xl">
          <div
            className="flex items-center gap-2 font-semibold tracking-tight text-zinc-900"
            style={{ fontFamily: "var(--font-sans), sans-serif" }}
          >
            <Utensils className="h-4 w-4" />
            <span>{restaurant.shortName}</span>
          </div>
          <div className="h-4 w-px bg-zinc-300" />
          <Link href="/" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">
            Reserve
          </Link>
          <Link href="/cater" className="text-sm text-zinc-600 transition-colors hover:text-zinc-900">
            Catering
          </Link>
        </nav>
        <div className="flex items-center gap-2" style={{ fontFamily: "var(--font-sans), sans-serif" }}>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: ACCENT }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download</span>
            <span className="sr-only sm:hidden">Download menu</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 rounded-full border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">{shareLabel || "Share"}</span>
            <span className="sr-only sm:hidden">{shareLabel || "Share menu"}</span>
          </button>
        </div>
      </header>

      {/* Legal-size menu canvas — drag / pinch to move around instead of scrolling */}
      <main className="relative z-10 min-h-0 flex-1 px-2 pb-2 sm:px-4 sm:pb-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="h-full"
        >
          <MenuCanvas className="h-full" />
        </motion.div>

        {/* Text version of the live menu for screen readers and search engines */}
        <div className="sr-only">
          <h1>{restaurant.name} Menu</h1>
          {menuError && <p role="alert">{menuError}</p>}
          {grouped.map(({ category, items }) => (
            <section key={category}>
              <h2>{category}</h2>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    {item.name}
                    {item.price ? ` — $${item.price}` : ""}
                    {item.description ? `. ${item.description}` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <p>
            {restaurant.address} · <a href={`tel:${restaurant.phone}`}>{restaurant.phoneLabel}</a>
          </p>
        </div>
      </main>

      {/* Floating LIVE / Closed trending button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.4 }}
        onClick={() => setShowTrending(true)}
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2.5 rounded-full bg-white border border-zinc-200 px-4 py-2.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.3)] transition-all duration-200 hover:-translate-y-0.5 active:scale-95 sm:bottom-8 sm:right-8"
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
