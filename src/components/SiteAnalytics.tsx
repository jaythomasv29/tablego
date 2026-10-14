'use client';
import { Analytics } from '@vercel/analytics/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
export default function SiteAnalytics() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);
  useEffect(() => { setAllowed(navigator.doNotTrack !== '1' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl !== true); }, []);
  return !allowed || pathname.startsWith('/mailing/') ? null : <Analytics beforeSend={event => {
    const url = new URL(event.url); if (url.pathname.startsWith('/mailing/')) return null;
    url.hash = ''; event.url = url.toString(); return event;
  }} />;
}
