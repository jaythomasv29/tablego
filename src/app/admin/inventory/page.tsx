'use client';

import { useState, useEffect } from 'react';
import {
    collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
    serverTimestamp, orderBy, query, limit, writeBatch, Timestamp
} from 'firebase/firestore';
import { db } from '@/firebase';
import { Plus, X, Package, ChevronDown, ChevronUp, Share2, Trash2, Phone, Flame, ArrowUp, ArrowDown } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

type ItemStatus = 'ok' | 'low' | 'out';

interface LocationDoc {
    id: string;
    name: string;
    sortOrder: number;
}

interface InventoryItem {
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

interface Vendor {
    id: string;
    name: string;
    phone: string;
    notes?: string;
}

interface OrderRecord {
    id: string;
    createdAt: Timestamp;
    vendorId: string;
    vendorName: string;
    items: { itemId: string; name: string; status: 'low' | 'out' }[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const OVERDUE_DAYS = 14;

const CATEGORIES = [
    'Produce',
    'Protein & Seafood',
    'Noodles & Rice',
    'Sauces & Condiments',
    'Pantry & Dry Goods',
    'Frozen',
    'Packaging & Supplies',
    'Beverages',
];

const STATUS_CONFIG: Record<ItemStatus, { label: string; activeClass: string; inactiveClass: string }> = {
    ok:  { label: '✓ OK',   activeClass: 'bg-green-100 text-green-700 border-green-300 font-semibold', inactiveClass: 'bg-white text-gray-400 border-gray-200 hover:border-green-200 hover:text-green-600' },
    low: { label: '⚡ Low', activeClass: 'bg-amber-100 text-amber-700 border-amber-300 font-semibold', inactiveClass: 'bg-white text-gray-400 border-gray-200 hover:border-amber-200 hover:text-amber-600' },
    out: { label: '✕ Out',  activeClass: 'bg-red-100 text-red-700 border-red-300 font-semibold',      inactiveClass: 'bg-white text-gray-400 border-gray-200 hover:border-red-200 hover:text-red-600' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysSinceNum(ts: Timestamp | null): number | null {
    if (!ts) return null;
    return Math.floor((Date.now() - ts.toMillis()) / 86_400_000);
}

function daysSinceLabel(ts: Timestamp | null): string | null {
    const d = daysSinceNum(ts);
    if (d === null) return null;
    return d === 0 ? 'today' : `${d}d ago`;
}

function formatDate(ts: Timestamp): string {
    return ts.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Blank form state ─────────────────────────────────────────────────────────

const BLANK_ITEM = { name: '', category: CATEGORIES[0], vendorId: '', location: '' };
const BLANK_VENDOR = { name: '', phone: '' };

// ─── Component ───────────────────────────────────────────────────────────────

type ActiveTab = 'stockcheck' | 'orderlist' | 'history';

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [locations, setLocations] = useState<LocationDoc[]>([]);
    const [orderHistory, setOrderHistory] = useState<OrderRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ActiveTab>('stockcheck');

    // Modals
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [isManagingVendors, setIsManagingVendors] = useState(false);
    const [isManagingLocations, setIsManagingLocations] = useState(false);
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

    // Forms
    const [newItem, setNewItem] = useState(BLANK_ITEM);
    const [newVendor, setNewVendor] = useState(BLANK_VENDOR);
    const [newLocationName, setNewLocationName] = useState('');
    const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
    const [editingLocationName, setEditingLocationName] = useState('');

    // History
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // ── Firestore listeners ──────────────────────────────────────────────────

    useEffect(() => {
        const unsubs = [
            onSnapshot(collection(db, 'inventoryVendors'), snap => {
                setVendors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor)));
            }),
            onSnapshot(
                query(collection(db, 'inventoryLocations'), orderBy('sortOrder')),
                snap => setLocations(snap.docs.map(d => ({ id: d.id, ...d.data() } as LocationDoc)))
            ),
            onSnapshot(collection(db, 'inventoryItems'), snap => {
                setItems(snap.docs.map(d => ({ id: d.id, isHot: false, ...d.data() } as InventoryItem)));
                setLoading(false);
            }),
            onSnapshot(
                query(collection(db, 'inventoryOrders'), orderBy('createdAt', 'desc'), limit(100)),
                snap => setOrderHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as OrderRecord)))
            ),
        ];
        return () => unsubs.forEach(u => u());
    }, []);

    // ── Handlers ────────────────────────────────────────────────────────────

    async function handleUpdateStatus(itemId: string, status: ItemStatus) {
        await updateDoc(doc(db, 'inventoryItems', itemId), { status, lastCheckedAt: serverTimestamp() });
    }

    async function handleToggleHot(itemId: string, current: boolean) {
        await updateDoc(doc(db, 'inventoryItems', itemId), { isHot: !current });
    }

    async function handleMoveLocation(itemId: string, newLocation: string) {
        await updateDoc(doc(db, 'inventoryItems', itemId), { location: newLocation });
    }

    async function handleMarkVendorOrdered(vendorId: string) {
        const vendorItems = items.filter(i => i.vendorId === vendorId && i.status !== 'ok');
        if (vendorItems.length === 0) return;
        const vendor = vendors.find(v => v.id === vendorId);
        const orderItems = vendorItems.map(i => ({ itemId: i.id, name: i.name, status: i.status as 'low' | 'out' }));
        await addDoc(collection(db, 'inventoryOrders'), {
            createdAt: serverTimestamp(),
            vendorId,
            vendorName: vendor?.name ?? '',
            items: orderItems,
        });
        await Promise.all(vendorItems.map(i =>
            updateDoc(doc(db, 'inventoryItems', i.id), { status: 'ok', lastOrderedAt: serverTimestamp() })
        ));
        toast.success(`Order recorded for ${vendor?.name}`);
    }

    async function handleAddItem() {
        if (!newItem.name.trim() || !newItem.vendorId || !newItem.location) {
            toast.error('Name, vendor, and location are required');
            return;
        }
        const vendor = vendors.find(v => v.id === newItem.vendorId);
        await addDoc(collection(db, 'inventoryItems'), {
            name: newItem.name.trim(),
            category: newItem.category,
            vendorId: newItem.vendorId,
            vendorName: vendor?.name ?? '',
            location: newItem.location,
            status: 'ok',
            isHot: false,
            lastCheckedAt: null,
            lastOrderedAt: null,
        });
        setNewItem({ ...BLANK_ITEM, location: newItem.location, vendorId: newItem.vendorId, category: newItem.category });
        setIsAddingItem(false);
        toast.success('Item added');
    }

    async function handleSaveEdit() {
        if (!editingItem) return;
        const vendor = vendors.find(v => v.id === editingItem.vendorId);
        await updateDoc(doc(db, 'inventoryItems', editingItem.id), {
            name: editingItem.name,
            category: editingItem.category,
            vendorId: editingItem.vendorId,
            vendorName: vendor?.name ?? editingItem.vendorName,
            location: editingItem.location,
        });
        setEditingItem(null);
        toast.success('Item updated');
    }

    async function handleDeleteItem(id: string) {
        await deleteDoc(doc(db, 'inventoryItems', id));
        setEditingItem(null);
        toast.success('Item deleted');
    }

    async function handleAddVendor() {
        if (!newVendor.name.trim() || !newVendor.phone.trim()) { toast.error('Name and phone are required'); return; }
        await addDoc(collection(db, 'inventoryVendors'), { name: newVendor.name.trim(), phone: newVendor.phone.trim() });
        setNewVendor(BLANK_VENDOR);
        toast.success('Vendor added');
    }

    async function handleDeleteVendor(id: string) {
        if (items.some(i => i.vendorId === id)) { toast.error('Remove all items from this vendor first'); return; }
        await deleteDoc(doc(db, 'inventoryVendors', id));
        toast.success('Vendor removed');
    }

    async function handleAddLocation() {
        if (!newLocationName.trim()) return;
        const maxOrder = locations.length > 0 ? Math.max(...locations.map(l => l.sortOrder)) + 1 : 0;
        await addDoc(collection(db, 'inventoryLocations'), { name: newLocationName.trim(), sortOrder: maxOrder });
        setNewLocationName('');
        toast.success('Location added');
    }

    async function handleRenameLocation(id: string, oldName: string, newName: string) {
        const trimmed = newName.trim();
        if (!trimmed || trimmed === oldName) { setEditingLocationId(null); return; }
        await updateDoc(doc(db, 'inventoryLocations', id), { name: trimmed });
        // Batch update all items referencing this location
        const toUpdate = items.filter(i => i.location === oldName);
        if (toUpdate.length > 0) {
            const batch = writeBatch(db);
            toUpdate.forEach(i => batch.update(doc(db, 'inventoryItems', i.id), { location: trimmed }));
            await batch.commit();
        }
        setEditingLocationId(null);
        toast.success('Location renamed');
    }

    async function handleDeleteLocation(id: string, name: string) {
        if (items.some(i => i.location === name)) { toast.error('Move all items from this location first'); return; }
        await deleteDoc(doc(db, 'inventoryLocations', id));
        toast.success('Location removed');
    }

    async function handleReorderLocation(id: string, direction: 'up' | 'down') {
        const sorted = [...locations].sort((a, b) => a.sortOrder - b.sortOrder);
        const idx = sorted.findIndex(l => l.id === id);
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= sorted.length) return;
        const batch = writeBatch(db);
        batch.update(doc(db, 'inventoryLocations', sorted[idx].id), { sortOrder: sorted[swapIdx].sortOrder });
        batch.update(doc(db, 'inventoryLocations', sorted[swapIdx].id), { sortOrder: sorted[idx].sortOrder });
        await batch.commit();
    }

    async function handleShare() {
        const needsOrder = items.filter(i => i.status !== 'ok');
        if (needsOrder.length === 0) { toast('Nothing to order — all items are stocked'); return; }
        const byVendor: Record<string, { vendorName: string; items: InventoryItem[] }> = {};
        for (const item of needsOrder) {
            if (!byVendor[item.vendorId]) byVendor[item.vendorId] = { vendorName: item.vendorName, items: [] };
            byVendor[item.vendorId].items.push(item);
        }
        const lines: string[] = ['📦 Order List\n'];
        for (const { vendorName, items: vItems } of Object.values(byVendor)) {
            lines.push(`${vendorName}:`);
            for (const item of vItems) lines.push(`  - ${item.name} [${item.status.toUpperCase()}]`);
            lines.push('');
        }
        const text = lines.join('\n');
        if (navigator.share) {
            await navigator.share({ title: 'Order List', text });
        } else {
            await navigator.clipboard.writeText(text);
            toast.success('Order list copied to clipboard');
        }
    }

    // ── Derived state ────────────────────────────────────────────────────────

    const needsOrderCount = items.filter(i => i.status !== 'ok').length;
    const sortedLocations = [...locations].sort((a, b) => a.sortOrder - b.sortOrder);

    const vendorOrderGroups = (() => {
        const needsOrder = items.filter(i => i.status !== 'ok');
        const map: Record<string, { vendor: Vendor; items: InventoryItem[] }> = {};
        for (const item of needsOrder) {
            if (!map[item.vendorId]) {
                const vendor = vendors.find(v => v.id === item.vendorId) ?? { id: item.vendorId, name: item.vendorName, phone: '' };
                map[item.vendorId] = { vendor, items: [] };
            }
            map[item.vendorId].items.push(item);
        }
        return Object.values(map).sort((a, b) => a.vendor.name.localeCompare(b.vendor.name));
    })();

    // ── Render ───────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Package className="w-6 h-6 text-gray-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Inventory & Ordering</h1>
                        <p className="text-sm text-gray-500">Nightly stock check and order management</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsManagingLocations(true)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                        Locations
                    </button>
                    <button
                        onClick={() => setIsManagingVendors(true)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                        Vendors
                    </button>
                    <button
                        onClick={() => { setIsAddingItem(true); setNewItem({ ...BLANK_ITEM, location: sortedLocations[0]?.name ?? '' }); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" /> Add Item
                    </button>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-0 border-b border-gray-200 mb-6">
                {([
                    { key: 'stockcheck', label: 'Stock Check' },
                    { key: 'orderlist',  label: needsOrderCount > 0 ? `Order List (${needsOrderCount})` : 'Order List' },
                    { key: 'history',    label: 'History' },
                ] as { key: ActiveTab; label: string }[]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.key
                                ? 'border-blue-600 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        } ${tab.key === 'orderlist' && needsOrderCount > 0 && activeTab !== 'orderlist' ? 'text-amber-600' : ''}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab: Stock Check ──────────────────────────────────────────── */}
            {activeTab === 'stockcheck' && (
                <div className="space-y-5">
                    {sortedLocations.map(loc => {
                        const locItems = items
                            .filter(i => i.location === loc.name)
                            .sort((a, b) => {
                                if (a.isHot && !b.isHot) return -1;
                                if (!a.isHot && b.isHot) return 1;
                                return a.name.localeCompare(b.name);
                            });
                        if (locItems.length === 0) return null;
                        return (
                            <div key={loc.id}>
                                <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{loc.name}</h2>
                                    <span className="text-xs text-gray-400">({locItems.length})</span>
                                </div>
                                {/* Grid of item cards — max height with scroll if many items */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                                    {locItems.map(item => {
                                        const orderedDays = daysSinceNum(item.lastOrderedAt);
                                        const ordered = daysSinceLabel(item.lastOrderedAt);
                                        const orderedColor = orderedDays === null ? 'text-gray-400'
                                            : orderedDays > 14 ? 'text-red-500'
                                            : orderedDays > 7 ? 'text-amber-500'
                                            : 'text-gray-400';
                                        const statusBorder = item.status === 'out' ? 'border-red-200 bg-red-50'
                                            : item.status === 'low' ? 'border-amber-200 bg-amber-50'
                                            : 'border-gray-200 bg-white';
                                        return (
                                            <div key={item.id} className={`border rounded-xl p-3 flex flex-col gap-2 ${statusBorder}`}>
                                                {/* Top row: hot toggle + name + location move */}
                                                <div className="flex items-start gap-1.5">
                                                    <button
                                                        onClick={() => handleToggleHot(item.id, item.isHot)}
                                                        title={item.isHot ? 'Remove hot flag' : 'Mark as frequently ordered'}
                                                        className={`shrink-0 p-0.5 rounded transition-colors mt-0.5 ${
                                                            item.isHot ? 'text-orange-500' : 'text-gray-200 hover:text-gray-400'
                                                        }`}
                                                    >
                                                        <Flame className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        className="flex-1 text-left min-w-0"
                                                        onClick={() => setEditingItem({ ...item })}
                                                    >
                                                        <div className="text-sm font-medium text-gray-900 leading-tight line-clamp-2">{item.name}</div>
                                                        <div className="text-xs text-gray-400 mt-0.5 truncate">{item.vendorName}</div>
                                                    </button>
                                                </div>

                                                {/* Location select + last ordered */}
                                                <div className="flex items-center justify-between gap-1">
                                                    <select
                                                        value={item.location}
                                                        onChange={e => handleMoveLocation(item.id, e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                        className="text-xs text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5 flex-1 min-w-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                    >
                                                        {sortedLocations.map(l => (
                                                            <option key={l.id} value={l.name}>{l.name}</option>
                                                        ))}
                                                    </select>
                                                    {ordered && (
                                                        <span className={`text-xs shrink-0 ${orderedColor}`}>{ordered}</span>
                                                    )}
                                                </div>

                                                {/* Status buttons */}
                                                <div className="flex gap-1">
                                                    {(['ok', 'low', 'out'] as ItemStatus[]).map(s => (
                                                        <button
                                                            key={s}
                                                            onClick={() => handleUpdateStatus(item.id, s)}
                                                            className={`flex-1 py-1 text-xs border rounded-md transition-colors ${
                                                                item.status === s
                                                                    ? STATUS_CONFIG[s].activeClass
                                                                    : STATUS_CONFIG[s].inactiveClass
                                                            }`}
                                                        >
                                                            {STATUS_CONFIG[s].label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    {/* Items with unknown/unmatched location */}
                    {(() => {
                        const knownLocNames = new Set(locations.map(l => l.name));
                        const orphans = items.filter(i => !knownLocNames.has(i.location));
                        if (orphans.length === 0) return null;
                        return (
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Unknown Location</h2>
                                    <span className="text-xs text-gray-300">({orphans.length})</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {orphans.map(item => (
                                        <div key={item.id} className="border border-orange-200 bg-orange-50 rounded-xl p-3 flex flex-col gap-2">
                                            <span className="text-sm font-medium text-gray-800">{item.name}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs text-orange-600 shrink-0">Move to:</span>
                                                <select
                                                    value=""
                                                    onChange={e => e.target.value && handleMoveLocation(item.id, e.target.value)}
                                                    className="text-xs text-gray-600 bg-white border border-orange-300 rounded px-1.5 py-0.5 flex-1 min-w-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-400"
                                                >
                                                    <option value="">({item.location || 'unknown'})</option>
                                                    {sortedLocations.map(l => (
                                                        <option key={l.id} value={l.name}>{l.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {items.length === 0 && (
                        <div className="text-center py-16 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm">No items yet — add your first item above</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Order List ───────────────────────────────────────────── */}
            {activeTab === 'orderlist' && (
                <div>
                    {vendorOrderGroups.length > 0 && (
                        <div className="flex justify-end mb-4">
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                            >
                                <Share2 className="w-4 h-4" /> Share
                            </button>
                        </div>
                    )}
                    {vendorOrderGroups.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <div className="text-4xl mb-3">✓</div>
                            <p className="text-sm font-medium text-gray-600">All stocked — nothing to order</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {vendorOrderGroups.map(({ vendor, items: vItems }) => (
                                <div key={vendor.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-gray-900">{vendor.name}</span>
                                                <span className="text-xs text-gray-400">({vItems.length} item{vItems.length !== 1 ? 's' : ''})</span>
                                            </div>
                                            {vendor.phone && (
                                                <a href={`tel:${vendor.phone}`} className="flex items-center gap-1 text-xs text-blue-600 mt-0.5 hover:underline">
                                                    <Phone className="w-3 h-3" /> {vendor.phone}
                                                </a>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleMarkVendorOrdered(vendor.id)}
                                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                        >
                                            Mark as Ordered
                                        </button>
                                    </div>
                                    <div className="divide-y divide-gray-100">
                                        {vItems.sort((a, b) => a.name.localeCompare(b.name)).map(item => {
                                            const orderedDays = daysSinceNum(item.lastOrderedAt);
                                            const isOverdue = orderedDays === null || orderedDays > OVERDUE_DAYS;
                                            return (
                                                <div key={item.id} className="flex items-start gap-3 px-4 py-2.5">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            {item.isHot && <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                                                            <span className="text-sm text-gray-900">{item.name}</span>
                                                        </div>
                                                        {isOverdue && (
                                                            <div className="text-xs text-amber-600 mt-0.5">
                                                                ⚠ {orderedDays === null ? 'Never ordered' : `Last ordered ${orderedDays}d ago`}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded shrink-0 mt-0.5">{item.location}</span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded shrink-0 mt-0.5 ${
                                                        item.status === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                        {item.status === 'out' ? 'Out' : 'Low'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: History ──────────────────────────────────────────────── */}
            {activeTab === 'history' && (
                <div className="space-y-2">
                    {orderHistory.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <p className="text-sm">No orders recorded yet</p>
                        </div>
                    ) : (
                        orderHistory.map(record => (
                            <div key={record.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                <button
                                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                                    onClick={() => setExpandedOrder(expandedOrder === record.id ? null : record.id)}
                                >
                                    <div>
                                        <span className="font-medium text-gray-900 text-sm">{record.vendorName}</span>
                                        <span className="text-xs text-gray-400 ml-2">{record.items.length} item{record.items.length !== 1 ? 's' : ''}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-400">{formatDate(record.createdAt)}</span>
                                        {expandedOrder === record.id
                                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                                        }
                                    </div>
                                </button>
                                {expandedOrder === record.id && (
                                    <div className="border-t border-gray-100 px-4 py-2 bg-gray-50 divide-y divide-gray-100">
                                        {record.items.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5">
                                                <span className="text-sm text-gray-700">{item.name}</span>
                                                <span className={`text-xs px-2 py-0.5 rounded ${
                                                    item.status === 'out' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                                }`}>
                                                    {item.status === 'out' ? 'Out' : 'Low'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Add Item Modal ────────────────────────────────────────────── */}
            {isAddingItem && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="font-semibold text-gray-900">Add Item</h2>
                            <button onClick={() => setIsAddingItem(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={newItem.name}
                                    onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Basil (4 lbs.)"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                <select value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor</label>
                                <select value={newItem.vendorId} onChange={e => setNewItem(p => ({ ...p, vendorId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select vendor...</option>
                                    {vendors.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                                <select value={newItem.location} onChange={e => setNewItem(p => ({ ...p, location: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Select location...</option>
                                    {sortedLocations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 p-5 border-t">
                            <button onClick={() => setIsAddingItem(false)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={handleAddItem} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Item</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Item Modal ───────────────────────────────────────────── */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="font-semibold text-gray-900">Edit Item</h2>
                            <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                                <input type="text" value={editingItem.name}
                                    onChange={e => setEditingItem(p => p ? { ...p, name: e.target.value } : p)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                <select value={editingItem.category} onChange={e => setEditingItem(p => p ? { ...p, category: e.target.value } : p)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Vendor</label>
                                <select value={editingItem.vendorId} onChange={e => setEditingItem(p => p ? { ...p, vendorId: e.target.value } : p)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {vendors.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                                        <option key={v.id} value={v.id}>{v.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                                <select value={editingItem.location} onChange={e => setEditingItem(p => p ? { ...p, location: e.target.value } : p)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {sortedLocations.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-2 p-5 border-t">
                            <button onClick={() => handleDeleteItem(editingItem.id)}
                                className="p-2 text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingItem(null)} className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Manage Vendors Modal ──────────────────────────────────────── */}
            {isManagingVendors && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="font-semibold text-gray-900">Manage Vendors</h2>
                            <button onClick={() => setIsManagingVendors(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-2">
                            {vendors.sort((a, b) => a.name.localeCompare(b.name)).map(v => (
                                <div key={v.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{v.name}</div>
                                        {v.phone && <div className="text-xs text-gray-400">{v.phone}</div>}
                                    </div>
                                    <button onClick={() => handleDeleteVendor(v.id)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {vendors.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No vendors yet</p>}
                        </div>
                        <div className="border-t p-5 space-y-3">
                            <p className="text-xs font-medium text-gray-700">Add vendor</p>
                            <input type="text" value={newVendor.name} onChange={e => setNewVendor(p => ({ ...p, name: e.target.value }))}
                                placeholder="Vendor name"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <input type="text" value={newVendor.phone} onChange={e => setNewVendor(p => ({ ...p, phone: e.target.value }))}
                                placeholder="Phone number"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            <button onClick={handleAddVendor} className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Vendor</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Manage Locations Modal ────────────────────────────────────── */}
            {isManagingLocations && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="font-semibold text-gray-900">Manage Locations</h2>
                            <button onClick={() => { setIsManagingLocations(false); setEditingLocationId(null); }} className="text-gray-400 hover:text-gray-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-5 space-y-2">
                            {sortedLocations.map((loc, idx) => (
                                <div key={loc.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg">
                                    {/* Reorder */}
                                    <div className="flex flex-col gap-0.5">
                                        <button onClick={() => handleReorderLocation(loc.id, 'up')} disabled={idx === 0}
                                            className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20">
                                            <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => handleReorderLocation(loc.id, 'down')} disabled={idx === sortedLocations.length - 1}
                                            className="p-0.5 text-gray-300 hover:text-gray-500 disabled:opacity-20">
                                            <ArrowDown className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {/* Name / inline edit */}
                                    {editingLocationId === loc.id ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingLocationName}
                                            onChange={e => setEditingLocationName(e.target.value)}
                                            onBlur={() => handleRenameLocation(loc.id, loc.name, editingLocationName)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRenameLocation(loc.id, loc.name, editingLocationName);
                                                if (e.key === 'Escape') setEditingLocationId(null);
                                            }}
                                            className="flex-1 px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    ) : (
                                        <button
                                            className="flex-1 text-left text-sm text-gray-900 hover:text-blue-600"
                                            onClick={() => { setEditingLocationId(loc.id); setEditingLocationName(loc.name); }}
                                        >
                                            {loc.name}
                                            <span className="text-xs text-gray-400 ml-2">
                                                ({items.filter(i => i.location === loc.name).length} items)
                                            </span>
                                        </button>
                                    )}

                                    <button onClick={() => handleDeleteLocation(loc.id, loc.name)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded shrink-0">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {locations.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No locations yet</p>}
                        </div>
                        <div className="border-t p-5 flex gap-2">
                            <input
                                type="text"
                                value={newLocationName}
                                onChange={e => setNewLocationName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddLocation()}
                                placeholder="New location name"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={handleAddLocation} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                Add
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
