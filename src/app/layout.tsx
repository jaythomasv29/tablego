import type { Metadata } from "next";
import { Inter, Cormorant_Garamond, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { defaultRestaurant } from '@/lib/restaurant/config';
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const editorial = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-editorial', preload: false, display: 'swap' });
const display = Playfair_Display({ subsets: ['latin'], weight: ['600', '700'], style: ['normal', 'italic'], variable: '--font-display', preload: false, display: 'swap' });

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
    <html lang="en" className={`${inter.variable} ${editorial.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <meta name="format-detection" content="telephone=no" />
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
