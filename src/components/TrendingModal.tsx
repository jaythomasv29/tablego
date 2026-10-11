'use client';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/firebase';
import Link from 'next/link';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function TrendingModal({ onClose }: { onClose: () => void; isOpen?: boolean }) {
  const { restaurant } = useTimezone();
  const [opener] = useState<HTMLElement | null>(() => typeof document === 'undefined' ? null : document.activeElement as HTMLElement);
  const [items, setItems] = useState<{ id: string; name: string; category: string }[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  useEffect(() => onSnapshot(collection(db, 'menu'), snapshot => {
    setItems(snapshot.docs.map(doc => ({ id: doc.id, name: String(doc.data().name || ''), category: String(doc.data().category || '') })).filter(item => item.name).slice(0, 7)); setLoading(false);
  }, () => { setError('Menu highlights could not be loaded.'); setLoading(false); }), []);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent onCloseAutoFocus={event => { if (opener?.isConnected) { event.preventDefault(); opener.focus(); } }} className="guest-management max-w-lg bg-white text-zinc-900">
    <DialogHeader><DialogTitle>{restaurant.shortName} menu highlights</DialogTitle><DialogDescription>Explore dishes on our current menu.</DialogDescription></DialogHeader>
    {loading ? <div role="status" className="h-32 animate-pulse rounded-md bg-zinc-100">Loading menu…</div> : error ? <p role="alert">{error}</p> : !items.length ? <p>Menu highlights will appear when dishes are added.</p> : <ul className="divide-y">{items.map(item => <li key={item.id} className="py-3"><p className="font-medium">{item.name}</p><p className="text-sm text-zinc-500">{item.category}</p></li>)}</ul>}
    <Link href="/menu" onClick={onClose} className="underline">View full menu</Link>
  </DialogContent></Dialog>;
}
