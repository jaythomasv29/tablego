'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/utils/analytics';

export function usePageTracking() {
    const pathname = usePathname();

    useEffect(() => {
        console.log('usePageTracking: pathname changed to', pathname);
        if (pathname) {
            trackPageView(pathname);
        }
    }, [pathname]);
}