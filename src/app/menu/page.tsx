'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Share2, Utensils } from 'lucide-react';
import { motion } from 'framer-motion';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';

const PDF_PATH = '/images/Thaiphoon_Food_Pics/Thaiphoon Dinner Menu.pdf';

const ACCENT = '#A3B18A';

const CATEGORY_ORDER = [
  'Appetizers',
  'Soup',
  'Salad',
  'Signature Dishes',
  'Wok',
  'Curry',
  'Noodles',
  'Fried Rice',
  'Grill',
  'Sides',
  'Desserts',
];

interface MenuItem {
  id?: string;
  name: string;
  price?: number;
  description: string;
  category: string;
  imageUrl: string;
}

function categoryId(cat: string) {
  return `cat-${cat.toLowerCase().replace(/\s+/g, '-')}`;
}

export default function MenuPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(CATEGORY_ORDER[0]);
  const [shareLabel, setShareLabel] = useState('');
  const observerRef = useRef<IntersectionObserver | null>(null);

  const trackEvent = async (type: 'download' | 'share') => {
    try {
      await addDoc(collection(db, 'menuDownloads'), { type, timestamp: serverTimestamp() });
    } catch (e) {
      console.error('Failed to track menu event:', e);
    }
  };

  const handleDownload = async () => {
    await trackEvent('download');
    const a = document.createElement('a');
    a.href = PDF_PATH;
    a.download = 'Thaiphoon Dinner Menu.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    const pdfUrl = window.location.origin + PDF_PATH;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Thaiphoon Restaurant Menu', url: pdfUrl });
        await trackEvent('share');
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(pdfUrl);
      await trackEvent('share');
      setShareLabel('Copied!');
      setTimeout(() => setShareLabel(''), 2000);
    }
  };

  useEffect(() => {
    getDocs(collection(db, 'menu'))
      .then(snap => {
        setMenuItems(
          snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem))
        );
      })
      .catch(err => console.error('Error fetching menu:', err))
      .finally(() => setLoading(false));
  }, []);

  // Track active category via IntersectionObserver
  useEffect(() => {
    if (loading) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      entries => {
        // Find the topmost section that is intersecting
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const id = visible[0].target.id;
          const cat = CATEGORY_ORDER.find(c => categoryId(c) === id);
          if (cat) setActiveCategory(cat);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 }
    );

    CATEGORY_ORDER.forEach(cat => {
      const el = document.getElementById(categoryId(cat));
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [loading]);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    const el = document.getElementById(categoryId(cat));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    items: menuItems.filter(item => item.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <div className="min-h-screen text-zinc-900" style={{ backgroundColor: 'transparent' }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Playfair+Display:ital,wght@1,600&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Film noise */}
      <svg className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]" aria-hidden="true">
        <filter id="film-noise-menu">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
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
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Utensils className="w-4 h-4" />
              <span>Thaiphoon</span>
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
              Reserve
            </Link>
            <Link href="/cater" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
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
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Thaiphoon · Palo Alto
          </p>
          <h1
            className="text-5xl md:text-6xl font-light text-white mb-3"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            Our Menu
          </h1>
          <p
            className="text-sm text-white/65 mb-6"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Thai &amp; Pan-Asian · Dine-in &amp; Takeout
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-zinc-900 transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: '#A3B18A', fontFamily: 'Inter, sans-serif' }}
            >
              <Download className="w-4 h-4" />
              Download Menu
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 rounded-full border border-white/40 bg-white/10 backdrop-blur-sm px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/20 active:scale-95"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              <Share2 className="w-4 h-4" />
              {shareLabel || 'Share'}
            </button>
          </div>
        </motion.div>
      </section>

      {/* Menu body — rises over video */}
      <section className="relative z-10 bg-[#F9F7F2] rounded-t-[2rem] -mt-6 min-h-screen">

        {/* Sticky category pill strip */}
        <div className="sticky top-0 z-30 bg-[#F9F7F2]/95 backdrop-blur-sm border-b border-zinc-100">
          <div className="max-w-6xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORY_ORDER.map(cat => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className="rounded-full px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-200"
                  style={
                    isActive
                      ? { backgroundColor: ACCENT, color: '#121212' }
                      : { border: '1px solid #d4d4d8', color: '#71717a', backgroundColor: 'transparent' }
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
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div
                className="w-8 h-8 rounded-full border-2 border-zinc-200 animate-spin"
                style={{ borderTopColor: ACCENT }}
              />
              <p className="text-sm text-zinc-400" style={{ fontFamily: 'Inter, sans-serif' }}>
                Loading menu…
              </p>
            </div>
          ) : (
            grouped.map(({ category, items }) => (
              <div key={category} id={categoryId(category)} className="scroll-mt-20">
                {/* Section header */}
                <div className="mb-6 flex items-center gap-5">
                  <h2
                    className="text-2xl font-light text-zinc-900 shrink-0"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {category}
                  </h2>
                  <div className="flex-1 h-px bg-zinc-200" />
                </div>

                {/* Item grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map(item => {
                    const hasImage = !!item.imageUrl;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl bg-white border border-zinc-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${!hasImage ? 'border-l-[3px]' : ''}`}
                        style={!hasImage ? { borderLeftColor: ACCENT } : undefined}
                      >
                        {hasImage && (
                          <div className="aspect-[4/3] w-full overflow-hidden bg-zinc-50">
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              onError={e => {
                                (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="p-4">
                          <div className="mb-1.5">
                            <h3
                              className="font-medium text-zinc-900 text-[0.95rem] leading-snug"
                              style={{ fontFamily: 'Inter, sans-serif' }}
                            >
                              {item.name}
                            </h3>
                          </div>
                          {item.description && (
                            <p
                              className="text-zinc-500 text-sm line-clamp-2"
                              style={{ fontFamily: 'Inter, sans-serif' }}
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
          <p className="text-sm text-zinc-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            Thaiphoon Restaurant · 543 Emerson St, Palo Alto ·{' '}
            <a href="tel:6503237700" className="hover:text-zinc-600 transition-colors">
              (650) 323-7700
            </a>
          </p>
          <div className="mt-4 flex justify-center gap-4">
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
              Reserve a Table
            </Link>
            <span className="text-zinc-300">·</span>
            <Link href="/cater" className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors">
              Catering Inquiry
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
