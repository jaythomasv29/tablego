'use client';

import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange>
            <TooltipProvider>
                {children}
            </TooltipProvider>
        </ThemeProvider>
    );
}
