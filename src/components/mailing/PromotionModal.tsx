'use client';
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Mail, X, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTimezone } from '@/contexts/TimezoneContext';
import { activePromotions } from '@/lib/mailing/promotion';
import EmailSignup from './EmailSignup';

export default function PromotionModal({ blocked, manuallyOpen, onClose }: { blocked: boolean; manuallyOpen: boolean; onClose: () => void }) {
  const { restaurant, timezone } = useTimezone(), [open, setOpen] = useState(false);
  const offers = activePromotions(timezone);
  const storageKey = `tablego-promotion:${offers.map(offer => offer.id).join(':') || 'monthly-offers-v1'}`;
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
    <Dialog.Content className="guest-management fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-zinc-200 bg-[#F9F7F2] text-zinc-900 shadow-2xl focus:outline-none"
      onCloseAutoFocus={event => { event.preventDefault(); document.getElementById('promotion-opener')?.focus(); }}
      onOpenAutoFocus={event => { event.preventDefault(); document.getElementById('promotion-close')?.focus(); }}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-zinc-200 bg-[#F9F7F2]/95 px-5 py-3 backdrop-blur sm:px-7">
        <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#526341]"><Mail className="h-4 w-4 shrink-0" />{restaurant.shortName} · Monthly offers</p>
        <Dialog.Close id="promotion-close" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100" aria-label="Close promotion"><X className="h-5 w-5" /></Dialog.Close>
      </header>
      <div className="px-5 pb-5 pt-5 sm:px-7 sm:pb-7">
        <Dialog.Title className="font-serif text-3xl leading-tight sm:text-4xl" style={{ fontFamily: 'var(--font-display), Georgia, serif' }}>Good things, on the menu.</Dialog.Title>
        <Dialog.Description className="mb-5 mt-2 text-sm leading-6 text-zinc-600">Current deals at {restaurant.shortName}. Take a look, then make yourself at home.</Dialog.Description>
        <div className="grid items-start gap-3 sm:grid-cols-2" aria-label="Current restaurant offers">
          {offers.map(offer => <article key={offer.id} className={`overflow-hidden rounded-2xl border ${offer.flyerUrl ? 'border-[#b64729]/25 bg-[#fff9f2]' : 'border-[#A3B18A]/50 bg-[#edf1e8]'}`}>
            <div className="p-4 sm:p-5"><p className={`mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${offer.flyerUrl ? 'text-[#a23b23]' : 'text-[#526341]'}`}>{offer.label}</p>
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-900">{offer.title}</h3>
              {offer.endsOn && <p className="mt-2 inline-flex rounded-full bg-[#b64729]/10 px-2.5 py-1 text-[11px] font-semibold text-[#a23b23]">Through {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${offer.endsOn}T12:00:00Z`))}</p>}
              <p className="mt-3 text-sm leading-6 text-zinc-700">{offer.description}</p><p className="mt-3 text-xs font-medium leading-5 text-zinc-700">{offer.qualification}</p>
              <details className="mt-3 border-t border-black/10 pt-3 text-xs leading-5 text-zinc-600"><summary className="cursor-pointer font-medium text-zinc-800 underline underline-offset-4">Offer terms{offer.flyerUrl ? ' & flyer' : ''}</summary><p className="mt-3">{offer.terms}</p>{offer.flyerUrl && <a href={offer.flyerUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[#a23b23] underline">View original flyer (PDF)<ExternalLink className="h-3 w-3" /></a>}{offer.image && <a href={offer.flyerUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block"><Image src={offer.image} width={1041} height={1347} alt={offer.imageAlt || offer.title} className="h-auto w-full rounded-lg" /></a>}</details>
              {!offer.flyerUrl && <Link href="/menu" className="mt-3 inline-flex text-xs font-medium text-[#526341] underline underline-offset-4">Explore the menu</Link>}
            </div>
          </article>)}
        </div>
        <section className="mt-5 border-t border-zinc-200 pt-5" aria-label="Optional email signup"><h3 className="text-base font-semibold text-zinc-900">Something delicious, every month.</h3><p className="mb-4 mt-1 text-xs leading-5 text-zinc-600">Get our latest promotions and special offers by email. Signup is optional and isn’t required to redeem these deals.</p><EmailSignup source="modal" onSuccess={remember} /></section>
        <Dialog.Close className="mt-3 w-full py-2 text-sm text-zinc-600 underline underline-offset-4">Maybe later</Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
