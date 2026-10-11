import type { Timestamp } from 'firebase/firestore';
export type ItemStatus = 'ok' | 'low' | 'out';

export interface LocationDoc {
    id: string;
    name: string;
    sortOrder: number;
}

export interface InventoryItem {
    id: string;
    name: string;
    category: string;
    vendorId: string;
    vendorName: string;
    location: string;       // display name, matched against LocationDoc.name
    status: ItemStatus;
    isHot: boolean;
    lastCheckedAt: Timestamp | null;
    lastOrderedAt: Timestamp | null;
}

export interface Vendor {
    id: string;
    name: string;
    phone: string;
    notes?: string;
}

export interface OrderRecord {
    id: string;
    createdAt: Timestamp;
    vendorId: string;
    vendorName: string;
    items: { itemId: string; name: string; status: 'low' | 'out' }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const OVERDUE_DAYS = 14;

export const CATEGORIES = [
    'Produce',
    'Protein & Seafood',
    'Noodles & Rice',
    'Sauces & Condiments',
    'Pantry & Dry Goods',
    'Frozen',
    'Packaging & Supplies',
    'Beverages',
];

export const STATUS_CONFIG: Record<ItemStatus, { label: string; activeClass: string; inactiveClass: string }> = {
    ok:  { label: '✓ OK',   activeClass: 'bg-green-100 text-green-700 border-green-300 font-semibold', inactiveClass: 'bg-white text-gray-400 border-gray-200 hover:border-green-200 hover:text-green-600' },
    low: { label: '⚡ Low', activeClass: 'bg-amber-100 text-amber-700 border-amber-300 font-semibold', inactiveClass: 'bg-white text-gray-400 border-gray-200 hover:border-amber-200 hover:text-amber-600' },
    out: { label: '✕ Out',  activeClass: 'bg-red-100 text-red-700 border-red-300 font-semibold',      inactiveClass: 'bg-white text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-600' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function daysSinceNum(ts: Timestamp | null): number | null {
    if (!ts) return null;
    return Math.floor((Date.now() - ts.toMillis()) / 86_400_000);
}

export function daysSinceLabel(ts: Timestamp | null): string | null {
    const d = daysSinceNum(ts);
    if (d === null) return null;
    return d === 0 ? 'today' : `${d}d ago`;
}

export function formatDate(ts: Timestamp, timeZone: string): string {
    return ts.toDate().toLocaleDateString('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Blank form state ─────────────────────────────────────────────────────────

export const BLANK_ITEM = { name: '', category: CATEGORIES[0], vendorId: '', location: '' };
export const BLANK_VENDOR = { name: '', phone: '' };

// ─── Component ───────────────────────────────────────────────────────────────

export type ActiveTab = 'stockcheck' | 'orderlist' | 'history';
