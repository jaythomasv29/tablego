'use client';
import { useTimezone } from '@/contexts/TimezoneContext';
import Link from 'next/link';
export default function Footer() {
  const { restaurant } = useTimezone();
  return <footer className="bg-white text-zinc-600 border-t mt-auto"><div className="max-w-7xl mx-auto px-4 py-4 grid gap-2 text-center text-xs">
    <a href={restaurant.mapsUrl} target="_blank" rel="noopener noreferrer">{restaurant.address}</a>
    <a href={restaurant.website} target="_blank" rel="noopener noreferrer">{restaurant.name}</a>
    <a href={`tel:${restaurant.phone}`}>{restaurant.phoneLabel}</a><a href={`mailto:${restaurant.email}`}>Contact us</a><Link href="/privacy" className="underline">Privacy & email preferences</Link>
  </div></footer>;
}
