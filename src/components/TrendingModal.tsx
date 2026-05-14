'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Data ────────────────────────────────────────────────────────────────────

export const TRENDING_ITEMS = [
  { id: 't1', name: 'Yellow Curry Chicken', category: 'Curry' },
  { id: 't2', name: 'Pad Thai Prawns', category: 'Noodles' },
  { id: 't3', name: 'Shaken Beef', category: 'Signature Dishes' },
  { id: 't4', name: 'Pad Se Ew Beef', category: 'Noodles' },
  { id: 't5', name: 'Mango Cashew Chicken', category: 'Signature Dishes' },
  { id: 't6', name: 'Spicy Chicken Basil Fried Rice', category: 'Fried Rice' },
  { id: 't7', name: 'Chow Mein', category: 'Noodles' },
];

const LOCATIONS = [
  'Table 2', 'Table 4', 'Table 5', 'Table 6',
  'Table 8', 'Table 9', 'Table 11', 'Takeout', 'Table 3',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function getHeatColor(intensity: number): string {
  if (intensity >= 0.88) return '#EF4444';
  if (intensity >= 0.70) return '#F97316';
  if (intensity >= 0.52) return '#F59E0B';
  if (intensity >= 0.34) return '#FCD34D';
  return '#FDE68A';
}

function formatSecondsAgo(s: number): string {
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  return m === 1 ? '1 min ago' : `${m} min ago`;
}

interface RecentOrder {
  id: number;
  item: string;
  location: string;
  secondsAgo: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TrendingModal({ onClose }: { onClose: () => void }) {
  const seed = getDailySeed();

  const baseCounts = Object.fromEntries(
    TRENDING_ITEMS.map((item, i) => [
      item.id,
      Math.floor(seededRandom(seed + i * 13) * 29) + 22,
    ])
  );

  const [counts, setCounts] = useState<Record<string, number>>(baseCounts);
  const [flashItems, setFlashItems] = useState<Set<string>>(new Set());
  const [totalToday, setTotalToday] = useState(
    Object.values(baseCounts).reduce((a, b) => a + b, 0)
  );
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>(() =>
    TRENDING_ITEMS.slice(0, 5)
      .map((item, i) => ({
        id: i,
        item: item.name,
        location: LOCATIONS[Math.floor(seededRandom(seed + i * 7) * LOCATIONS.length)],
        secondsAgo:
          Math.floor(seededRandom(seed + i * 3) * 10) * 60 +
          Math.floor(seededRandom(seed + i) * 55) + 25,
      }))
      .sort((a, b) => a.secondsAgo - b.secondsAgo)
  );

  const nextIdRef = useRef(100);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const tick = setInterval(() => {
      setRecentOrders(prev => prev.map(o => ({ ...o, secondsAgo: o.secondsAgo + 1 })));
    }, 1000);

    const fireOrder = () => {
      const item = TRENDING_ITEMS[Math.floor(Math.random() * TRENDING_ITEMS.length)];
      const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];

      setCounts(prev => ({ ...prev, [item.id]: prev[item.id] + 1 }));
      setTotalToday(prev => prev + 1);

      setFlashItems(prev => new Set(prev).add(item.id));
      setTimeout(() => {
        setFlashItems(prev => {
          const next = new Set(prev);
          next.delete(item.id);
          return next;
        });
      }, 1800);

      setRecentOrders(prev => [
        { id: nextIdRef.current++, item: item.name, location, secondsAgo: 0 },
        ...prev.slice(0, 4),
      ]);

      timeoutRef.current = setTimeout(fireOrder, Math.random() * 10000 + 4000);
    };

    timeoutRef.current = setTimeout(fireOrder, Math.random() * 3000 + 2000);

    return () => {
      clearInterval(tick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sorted = [...TRENDING_ITEMS].sort((a, b) => counts[b.id] - counts[a.id]);
  const maxCount = Math.max(...Object.values(counts));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px] max-h-[85vh] overflow-hidden flex flex-col rounded-[2rem] bg-white border border-zinc-100 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.4)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span
                className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-500"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Live
              </span>
              <div className="h-3.5 w-px bg-zinc-200" />
              <h2
                className="text-[1.25rem] font-light text-zinc-900"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                Trending Now
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-1 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-sm text-zinc-400" style={{ fontFamily: 'Inter, sans-serif' }}>
            <span className="font-semibold text-zinc-700">{totalToday}</span> orders today · updating live
          </p>
        </div>

        {/* Items */}
        <div className="px-5 py-4 space-y-2 overflow-y-auto flex-1">
          <AnimatePresence mode="popLayout">
            {sorted.map((item, idx) => {
              const count = counts[item.id];
              const intensity = count / maxCount;
              const heatColor = getHeatColor(intensity);
              const isFlashing = flashItems.has(item.id);
              const barPct = Math.round(intensity * 100);

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, layout: { duration: 0.35, ease: 'easeInOut' } }}
                  className={`rounded-xl px-3.5 py-3 transition-colors duration-400 ${
                    isFlashing ? 'bg-amber-50' : 'bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="text-[11px] font-bold text-zinc-300 w-4 shrink-0 text-center"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className="text-sm font-medium text-zinc-900 truncate"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {item.name}
                      </span>
                      <span
                        className="hidden sm:inline text-[10px] text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5 shrink-0"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {item.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <AnimatePresence>
                        {isFlashing && (
                          <motion.span
                            key="plus"
                            initial={{ opacity: 0, y: 4, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -6 }}
                            transition={{ duration: 0.18 }}
                            className="text-[11px] font-bold text-orange-500"
                          >
                            +1
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <motion.span
                        key={count}
                        initial={{ scale: 1.25 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.2 }}
                        className="text-sm font-bold tabular-nums text-zinc-900"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                      >
                        {count}
                      </motion.span>
                    </div>
                  </div>

                  <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      animate={{ width: `${barPct}%` }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                      style={{ backgroundColor: heatColor }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Recent activity */}
        <div className="px-6 pt-3 pb-5 border-t border-zinc-100 shrink-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 mb-2.5"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Recent Activity
          </p>
          <div className="space-y-1.5">
            <AnimatePresence mode="popLayout">
              {recentOrders.slice(0, 4).map(order => (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="flex items-center gap-2 text-xs text-zinc-500"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-medium text-zinc-700 shrink-0">{order.location}</span>
                  <span className="text-zinc-300">·</span>
                  <span className="truncate text-zinc-500">{order.item}</span>
                  <span className="text-zinc-300 shrink-0">·</span>
                  <span className="shrink-0 text-zinc-400 tabular-nums">
                    {formatSecondsAgo(order.secondsAgo)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
