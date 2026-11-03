'use client';
import { Analytics } from '@vercel/analytics/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
const privateSurface = (pathname: string) => pathname.startsWith('/mailing/') || pathname.startsWith('/inventory/');
export default function SiteAnalytics() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { setAllowed(navigator.doNotTrack !== '1' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true); }, []);
  return !allowed || privateSurface(pathname) ? null : <Analytics beforeSend={event => {
    const url = new URL(event.url); if (privateSurface(url.pathname)) return null;
    url.hash = ''; event.url = url.toString(); return event;
  }} />;
}
