import type { Metadata } from 'next';
import SharedDailyStock from '@/components/inventory/SharedDailyStock';
export const metadata: Metadata = { title: 'Daily stock', robots: {index: false, follow: false}, referrer: 'no-referrer' };
export default function DailyStockPage() { return <SharedDailyStock/>; }
