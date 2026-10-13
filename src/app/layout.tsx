import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";
import { Analytics } from "@vercel/analytics/react";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { defaultRestaurant } from '@/lib/restaurant/config';
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: `${defaultRestaurant.name} - Reservations`,
  description: `Request a table at ${defaultRestaurant.name}`,
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="tablego-fonts" suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no" />
        <link rel="preload" href="/fonts/e4af272ccee01ff0-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {process.env.NEXT_PUBLIC_TABLEGO_PROVIDER_TEST === 'true' && <p className="border-b border-amber-300 bg-amber-50 p-3 text-center text-sm text-amber-950">Staging provider test: the approved test phone receives real verification texts, and the approved email receives real confirmations. Other messages are captured.</p>}
        <Providers>
          <TimezoneProvider>{children}</TimezoneProvider>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
