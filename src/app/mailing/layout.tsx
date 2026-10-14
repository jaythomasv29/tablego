import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Email preferences — Thaiphoon', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function MailingLayout({ children }: { children: React.ReactNode }) { return children; }
