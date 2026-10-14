'use client';
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Mail, X } from 'lucide-react';
import Image from 'next/image';
import { useTimezone } from '@/contexts/TimezoneContext';
import { currentPromotion } from '@/lib/mailing/promotion';
import { restaurantClock } from '@/lib/reservations/availability';
import EmailSignup from './EmailSignup';

export default function PromotionModal({ blocked, manuallyOpen, onClose }: { blocked: boolean; manuallyOpen: boolean; onClose: () => void }) {
  const { restaurant, timezone } = useTimezone(), [open, setOpen] = useState(false);
  const date = restaurantClock(timezone).date;
  const promotion = currentPromotion && (!currentPromotion.startsOn || currentPromotion.startsOn <= date) && (!currentPromotion.endsOn || currentPromotion.endsOn >= date) ? currentPromotion : null;
  const storageKey = `tablego-promotion:${promotion?.id || 'monthly-offers-v1'}`;
  function remember() { try { localStorage.setItem(storageKey, String(Date.now())); } catch {} }
  function changeOpen(value: boolean) { setOpen(value); if (!value) { remember(); onClose(); } }
  useEffect(() => {
    if (blocked) { setOpen(false); return; }
    if (manuallyOpen) { setOpen(true); return; }
    let seen = 0; try { seen = Number(localStorage.getItem(storageKey)) || 0; } catch {}
    if (seen > Date.now() - 7 * 86400_000) return;
    const timeout = setTimeout(() => {
      // Let people already using a form finish without another dialog interrupting.
      if (document.querySelector('[role="dialog"][data-state="open"]') || document.activeElement?.matches('input, textarea, select')) return;
      setOpen(true);
      try { localStorage.setItem(storageKey, String(Date.now())); } catch {}
    }, 3500);
    return () => clearTimeout(timeout);
  }, [blocked, manuallyOpen, storageKey]);
  return <Dialog.Root open={open && !blocked} onOpenChange={changeOpen}><Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm" />
    <Dialog.Content className="guest-management fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-zinc-200 bg-[#F9F7F2] text-zinc-900 shadow-2xl focus:outline-none"
      onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('promotion-opener')?.focus(); }}
      onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('promotion-close')?.focus(); }}>
      <Dialog.Close id="promotion-close" className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-700 hover:bg-zinc-100" aria-label="Close promotion"><X className="h-5 w-5" /></Dialog.Close>
      <div className="px-6 pb-6 pt-8 sm:px-8 sm:pb-8">
        <p className="mb-6 flex items-center gap-2 pr-10 text-xs uppercase tracking-[0.2em] text-[#526341]"><Mail className="h-4 w-4" />{restaurant.shortName} · Monthly moments</p>
        <Dialog.Title className="pr-4 font-serif text-4xl leading-tight" style={{ fontFamily: 'var(--font-display), Georgia, serif' }}>{promotion?.title || 'Something delicious, every month.'}</Dialog.Title>
        <Dialog.Description className="mb-5 mt-4 text-sm leading-6 text-zinc-600">{promotion?.description || `Get ${restaurant.shortName}’s latest monthly promotions and special offers in your inbox.`}</Dialog.Description>
        {promotion?.image && <a href={promotion.image} target="_blank" rel="noopener noreferrer" className="mb-5 block"><Image src={promotion.image} width={1000} height={1000} alt={promotion.imageAlt || 'Current restaurant promotion'} className="h-auto w-full rounded-xl" /></a>}
        {promotion?.terms && <p className="mb-5 rounded-xl border border-[#A3B18A]/40 bg-white p-3 text-xs leading-5 text-zinc-600">{promotion.terms}</p>}
        {promotion && <p className="mb-4 text-sm font-medium text-zinc-800">A new promotion every month. Stay in the loop.</p>}
        <EmailSignup source="modal" onSuccess={remember} />
        <Dialog.Close className="mt-5 w-full py-2 text-sm text-zinc-600 underline underline-offset-4">Maybe later</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
