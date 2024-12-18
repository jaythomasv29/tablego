import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import PageTracker from '@/components/PageTracker';
import Script from 'next/script';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Thaiphoon Restaurant - Reservations',
  description: 'Make a reservation at our Thaiphoon Restaurant',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-0WR2KXZKPB"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-0WR2KXZKPB');
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <PageTracker />
        {children}
      </body>
    </html>
  );
}