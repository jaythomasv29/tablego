'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import AdminLayout from '@/components/AdminLayout';
import { Printer, ChevronDown, ChevronRight, Search, X, Pencil, Check } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

type LabelStyle = 'classic' | 'elegant' | 'modern' | 'refined' | 'minimal' | 'rustic' | 'bold';

const RESTAURANT_NAME = 'Thaiphoon Restaurant · Palo Alto';

const PROTEINS = [
  'Chicken', 'Pork', 'Beef', 'Shrimp', 'Sole Fish',
  'Lamb', 'Salmon', 'Tofu', 'Tofu & Veggies', 'Veggies',
];

const CATEGORY_ORDER = [
  'Appetizers', 'Salad', 'Soup', 'Signature Dishes',
  'Wok', 'Curry', 'Noodles', 'Fried Rice', 'Grill', 'Sides',
];

function groupAndSort(items: MenuItem[]) {
  const grouped: Record<string, MenuItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }
  const covered = new Set(CATEGORY_ORDER);
  const ordered = CATEGORY_ORDER
    .filter(cat => grouped[cat]?.length)
    .map(cat => ({ category: cat, items: grouped[cat] }));
  const extras = Object.entries(grouped)
    .filter(([cat]) => !covered.has(cat))
    .map(([category, items]) => ({ category, items }));
  return [...ordered, ...extras];
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS — tent card styles + print layout
// Card spec: 3.5" wide × 4" tall flat → folds to 3.5" × 2" tent
// Page:      2 columns × 2 rows = 4 cards per letter page
// ─────────────────────────────────────────────────────────────────────────────
const TENT_CSS = `
  /* ── Shared structure ──────────────────────────────────────────── */
  .tc {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
  }
  .tc-back {
    flex: 0 0 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: rotate(180deg);
  }
  .tc-fold {
    border-top: 1px dashed #ccc;
    flex-shrink: 0;
  }
  .tc-front {
    flex: 0 0 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    position: relative;
  }
  .tc-divider { flex-shrink: 0; }
  .tc-footer {
    position: absolute;
    bottom: 7px;
    left: 0;
    right: 0;
    text-align: center;
  }

  /* ── Classic — white, serif, hairline border ────────────────────── */
  .tc-classic { background: #fff; border: 1px solid #e0e0e0; }
  .tc-classic .tc-back  { padding: 0 16px; }
  .tc-classic .tc-front { padding: 0 18px; gap: 6px; }
  .tc-classic .tc-restaurant,
  .tc-classic .tc-footer {
    font-family: Georgia, serif;
    font-size: 8px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #bbb;
  }
  .tc-classic .tc-name {
    font-family: Georgia, serif;
    font-size: 20px;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #1a1a1a;
    line-height: 1.25;
    margin: 0;
  }
  .tc-classic .tc-divider {
    font-size: 10px;
    color: #ccc;
    letter-spacing: 0.4em;
    padding: 0 2px;
  }
  .tc-classic .tc-desc {
    font-family: Georgia, serif;
    font-size: 9px;
    color: #888;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Elegant — warm white, italic serif, gold accents ──────────── */
  .tc-elegant { background: #fafaf8; }
  .tc-elegant .tc-back  { padding: 0 20px; border-top: 1.5px solid #c8b89a; }
  .tc-elegant .tc-front { padding: 0 20px; gap: 5px; border-bottom: 1.5px solid #c8b89a; }
  .tc-elegant .tc-restaurant,
  .tc-elegant .tc-footer {
    font-family: Georgia, serif;
    font-size: 7px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #c8b89a;
  }
  .tc-elegant .tc-name {
    font-family: Georgia, serif;
    font-size: 20px;
    font-style: italic;
    font-weight: normal;
    color: #1a1a1a;
    line-height: 1.25;
    margin: 0;
  }
  .tc-elegant .tc-divider {
    width: 40px;
    border-top: 1px solid #c8b89a;
    align-self: center;
  }
  .tc-elegant .tc-desc {
    font-family: Georgia, serif;
    font-size: 9px;
    font-style: italic;
    color: #999;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Modern — white, bold sans, short rule ──────────────────────── */
  .tc-modern { background: #fff; border-top: 2.5px solid #1a1a1a; }
  .tc-modern .tc-back  { padding: 0 18px; }
  .tc-modern .tc-front { padding: 0 18px; gap: 5px; }
  .tc-modern .tc-restaurant,
  .tc-modern .tc-footer {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 7px;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #bbb;
  }
  .tc-modern .tc-name {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 17px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #111;
    line-height: 1.2;
    margin: 0;
  }
  .tc-modern .tc-divider {
    width: 28px;
    border-top: 1.5px solid #1a1a1a;
    align-self: center;
  }
  .tc-modern .tc-desc {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 9px;
    color: #777;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Refined — double border, very formal ──────────────────────── */
  .tc-refined {
    background: #fff;
    border: 1px solid #c8c8c8;
    box-shadow: inset 0 0 0 4px #fff, inset 0 0 0 5.5px #c8c8c8;
  }
  .tc-refined .tc-back  { padding: 0 22px; }
  .tc-refined .tc-front { padding: 0 22px; gap: 5px; }
  .tc-refined .tc-restaurant,
  .tc-refined .tc-footer {
    font-family: Georgia, serif;
    font-size: 7px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: #bbb;
  }
  .tc-refined .tc-name {
    font-family: Georgia, serif;
    font-size: 19px;
    font-weight: normal;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #1a1a1a;
    line-height: 1.25;
    margin: 0;
  }
  .tc-refined .tc-divider {
    width: 32px;
    border-top: 1px solid #c8c8c8;
    align-self: center;
  }
  .tc-refined .tc-desc {
    font-family: Georgia, serif;
    font-size: 9px;
    color: #888;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Minimal — extreme whitespace, no decoration ────────────────── */
  .tc-minimal { background: #fff; }
  .tc-minimal .tc-back  { padding: 0 28px; }
  .tc-minimal .tc-front { padding: 0 28px; gap: 8px; }
  .tc-minimal .tc-restaurant,
  .tc-minimal .tc-footer {
    font-family: Georgia, serif;
    font-size: 7px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #ccc;
  }
  .tc-minimal .tc-name {
    font-family: Georgia, serif;
    font-size: 24px;
    font-weight: normal;
    color: #111;
    line-height: 1.2;
    margin: 0;
  }
  .tc-minimal .tc-divider { display: none; }
  .tc-minimal .tc-desc {
    font-family: Georgia, serif;
    font-size: 9px;
    color: #aaa;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Rustic — warm tan, earthy serif ────────────────────────────── */
  .tc-rustic { background: #faf5ee; }
  .tc-rustic .tc-back  { padding: 0 20px; border-top: 1px solid #c4a882; }
  .tc-rustic .tc-front { padding: 0 20px; gap: 5px; border-bottom: 1px solid #c4a882; }
  .tc-rustic .tc-restaurant,
  .tc-rustic .tc-footer {
    font-family: Georgia, serif;
    font-size: 7px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #c4a882;
  }
  .tc-rustic .tc-name {
    font-family: Georgia, serif;
    font-size: 21px;
    font-style: italic;
    font-weight: normal;
    color: #3d2b1f;
    line-height: 1.25;
    margin: 0;
  }
  .tc-rustic .tc-divider {
    width: 36px;
    border-top: 1px solid #c4a882;
    align-self: center;
  }
  .tc-rustic .tc-desc {
    font-family: Georgia, serif;
    font-size: 9px;
    color: #8a7060;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Bold — thick top/bottom rules, oversized name ──────────────── */
  .tc-bold {
    background: #fff;
    border-top: 3px solid #1a1a1a;
    border-bottom: 3px solid #1a1a1a;
  }
  .tc-bold .tc-back  { padding: 0 20px; }
  .tc-bold .tc-front { padding: 0 20px; gap: 4px; }
  .tc-bold .tc-restaurant,
  .tc-bold .tc-footer {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 7px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: #bbb;
  }
  .tc-bold .tc-name {
    font-family: Georgia, serif;
    font-size: 26px;
    font-weight: normal;
    color: #111;
    line-height: 1.1;
    margin: 0;
  }
  .tc-bold .tc-divider { display: none; }
  .tc-bold .tc-desc {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 9px;
    color: #888;
    line-height: 1.5;
    margin: 0;
  }

  /* ── Protein line (shared + per-style overrides) ───────────────── */
  .tc-protein { margin: 0; line-height: 1.2; flex-shrink: 0; }
  .tc-classic .tc-protein { font-family: Georgia, serif; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; color: #aaa; }
  .tc-elegant .tc-protein { font-family: Georgia, serif; font-size: 10px; font-style: italic; color: #c8b89a; }
  .tc-modern  .tc-protein { font-family: system-ui, sans-serif; font-size: 9px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #888; }
  .tc-refined .tc-protein { font-family: Georgia, serif; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: #aaa; }
  .tc-minimal .tc-protein { font-family: Georgia, serif; font-size: 11px; color: #bbb; }
  .tc-rustic  .tc-protein { font-family: Georgia, serif; font-size: 10px; font-style: italic; color: #c4a882; }
  .tc-bold    .tc-protein { font-family: Georgia, serif; font-size: 12px; color: #888; }

  /* ── Print layout ───────────────────────────────────────────────── */
  @page { size: letter portrait; margin: 0.5in; }

  @media print {
    body * { visibility: hidden !important; }
    #label-print-root,
    #label-print-root * { visibility: visible !important; }
    #label-print-root {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
    }

    /* Each "page" holds 2 rows of 2 cards */
    .print-page {
      page-break-after: always;
      break-after: page;
    }
    .print-page:last-child {
      page-break-after: avoid;
      break-after: avoid;
    }

    /* Row = 2 cards side by side */
    .print-row {
      display: flex;
      gap: 0.25in;
    }
    .print-row-cut {
      border-top: 1px dashed #aaa;
      margin: 0.15in 0;
    }

    /* Each card: 3.5" wide × 4" tall */
    .tc {
      width: 3.5in;
      height: 4in;
      flex-shrink: 0;
      outline: 1px dashed #aaa;
    }
    .tc-back  { height: 2in; flex: 0 0 2in; padding: 0 24pt !important; }
    .tc-front { height: 2in; flex: 0 0 2in; padding: 0 24pt !important; }

  }
`;

// ── Full tent card used in print output ───────────────────────────────────────
const DIVIDER_LINE_STYLES: LabelStyle[] = ['elegant', 'modern', 'refined', 'rustic'];
const NO_DIVIDER_STYLES: LabelStyle[] = ['minimal', 'bold'];

function TentCard({ item, labelStyle, protein }: { item: MenuItem; labelStyle: LabelStyle; protein?: string }) {
  const isDividerLine = DIVIDER_LINE_STYLES.includes(labelStyle);
  const hasDivider = !NO_DIVIDER_STYLES.includes(labelStyle);
  return (
    <div className={`tc tc-${labelStyle}`}>
      <div className="tc-back">
        <span className="tc-restaurant">{RESTAURANT_NAME}</span>
      </div>
      <div className="tc-fold" />
      <div className="tc-front">
        <p className="tc-name">{item.name}</p>
        {protein && <p className="tc-protein">{protein}</p>}
        {hasDivider && (isDividerLine
          ? <div className="tc-divider" />
          : <span className="tc-divider">· · ·</span>
        )}
        {item.description && <p className="tc-desc">{item.description}</p>}
        <span className="tc-footer">{RESTAURANT_NAME}</span>
      </div>
    </div>
  );
}

// ── Preview card — shows only the front face at screen scale ──────────────────
// Proportional to 3.5" × 2" (front half only)
function PreviewCard({ item, labelStyle, protein }: { item: MenuItem; labelStyle: LabelStyle; protein?: string }) {
  const isDividerLine = DIVIDER_LINE_STYLES.includes(labelStyle);
  const hasDivider = !NO_DIVIDER_STYLES.includes(labelStyle);
  // Inline size overrides to keep preview compact
  const frontStyle: React.CSSProperties = {
    height: 110,
    flex: 'none',
    padding: '0 14px',
    gap: 5,
  };
  const nameSize = labelStyle === 'bold' ? 18 : labelStyle === 'modern' ? 12 : 13;
  const previewOverrides: React.CSSProperties = {
    height: 110,
    ...(labelStyle === 'elegant' ? { borderBottom: '1.5px solid #c8b89a', borderTop: 'none' } : {}),
    ...(labelStyle === 'modern'  ? { borderTop: 'none', borderLeft: 'none' } : {}),
    ...(labelStyle === 'rustic'  ? { borderBottom: '1px solid #c4a882', borderTop: 'none' } : {}),
    ...(labelStyle === 'bold'    ? { borderBottom: '2px solid #1a1a1a', borderTop: 'none' } : {}),
  };
  return (
    <div className={`tc tc-${labelStyle}`} style={previewOverrides}>
      <div className="tc-front" style={frontStyle}>
        <p className="tc-name" style={{ fontSize: nameSize, letterSpacing: '0.06em' }}>{item.name}</p>
        {protein && <p className="tc-protein" style={{ fontSize: 8 }}>{protein}</p>}
        {hasDivider && (isDividerLine
          ? <div className="tc-divider" style={{ width: 24 }} />
          : <span className="tc-divider" style={{ fontSize: 8 }}>· · ·</span>
        )}
        {item.description && (
          <p
            className="tc-desc"
            style={{
              fontSize: 8,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </p>
        )}
        <span className="tc-footer" style={{ fontSize: 7, bottom: 5 }}>{RESTAURANT_NAME}</span>
      </div>
    </div>
  );
}

interface LabelEntry {
  instanceId: string;
  itemId: string;
  protein: string;
  customName?: string;
  customDesc?: string;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LabelingPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customItems, setCustomItems] = useState<MenuItem[]>([]);
  const [labelEntries, setLabelEntries] = useState<LabelEntry[]>([]);
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('classic');
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [editingInstanceId, setEditingInstanceId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'menu')),
      getDocs(collection(db, 'labelItems')),
    ])
      .then(([menuSnap, labelSnap]) => {
        setMenuItems(menuSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name ?? '',
          description: d.data().description ?? '',
          category: d.data().category ?? 'Other',
        })));
        setCustomItems(labelSnap.docs.map(d => ({
          id: d.id,
          name: d.data().name ?? '',
          description: d.data().description ?? '',
          category: 'Custom',
        })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const allItems = [...menuItems, ...customItems];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? allItems.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    : allItems;
  const groups = groupAndSort(filtered);
  const customIdSet = new Set(customItems.map(i => i.id));

  // Entries drive the print output — each entry = one card
  const pages = chunk(labelEntries, 4);

  const newEntry = (itemId: string): LabelEntry =>
    ({ instanceId: `inst-${Date.now()}-${Math.random()}`, itemId, protein: '' });

  const toggle = (itemId: string) => {
    const hasAny = labelEntries.some(e => e.itemId === itemId);
    setLabelEntries(prev =>
      hasAny ? prev.filter(e => e.itemId !== itemId) : [...prev, newEntry(itemId)]
    );
  };

  const addInstance = (itemId: string) =>
    setLabelEntries(prev => [...prev, newEntry(itemId)]);

  const removeEntry = (instanceId: string) =>
    setLabelEntries(prev => prev.filter(e => e.instanceId !== instanceId));

  const selectProtein = (instanceId: string, protein: string) =>
    setLabelEntries(prev => prev.map(e =>
      e.instanceId === instanceId ? { ...e, protein: e.protein === protein ? '' : protein } : e
    ));

  const updateEntryText = (instanceId: string, field: 'customName' | 'customDesc', value: string) =>
    setLabelEntries(prev => prev.map(e =>
      e.instanceId === instanceId ? { ...e, [field]: value } : e
    ));


  const toggleGroup = (items: MenuItem[]) => {
    const allOn = items.every(i => labelEntries.some(e => e.itemId === i.id));
    if (allOn) {
      setLabelEntries(prev => prev.filter(e => !items.some(i => i.id === e.itemId)));
    } else {
      const newEntries = items
        .filter(i => !labelEntries.some(e => e.itemId === i.id))
        .map(i => newEntry(i.id));
      setLabelEntries(prev => [...prev, ...newEntries]);
    }
  };

  const addCustomItem = async () => {
    const name = customName.trim();
    if (!name) return;
    const desc = customDesc.trim();
    // Optimistic UI with temp ID
    const tempId = `custom-${Date.now()}`;
    setCustomItems(prev => [...prev, { id: tempId, name, description: desc, category: 'Custom' }]);
    setLabelEntries(prev => [...prev, newEntry(tempId)]);
    setCustomName('');
    setCustomDesc('');
    // Persist to Firestore, swap temp ID for real doc ID
    try {
      const ref = await addDoc(collection(db, 'labelItems'), { name, description: desc, createdAt: Timestamp.now() });
      setCustomItems(prev => prev.map(i => i.id === tempId ? { ...i, id: ref.id } : i));
      setLabelEntries(prev => prev.map(e => e.itemId === tempId ? { ...e, itemId: ref.id } : e));
    } catch (err) {
      console.error('Failed to save custom item:', err);
    }
  };

  const removeCustomItem = async (id: string) => {
    setCustomItems(prev => prev.filter(i => i.id !== id));
    setLabelEntries(prev => prev.filter(e => e.itemId !== id));
    if (!id.startsWith('custom-')) {
      try { await deleteDoc(doc(db, 'labelItems', id)); }
      catch (err) { console.error('Failed to delete custom item:', err); }
    }
  };

  const toggleCollapse = (cat: string) =>
    setCollapsed(prev => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });

  return (
    <AdminLayout>
      <style>{TENT_CSS}</style>

      {/* ── Screen UI ──────────────────────────────────────────── */}
      <div className="print:hidden flex flex-col p-4 sm:p-6 bg-gray-50 min-h-screen">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Food Label Maker</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              3.5″ × 2″ folded tent cards · 4 per page
            </p>
          </div>
          <button
            onClick={() => window.print()}
            disabled={labelEntries.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Labels{labelEntries.length > 0 ? ` (${labelEntries.length})` : ''}
          </button>
        </div>

        {/* Style picker */}
        <div className="flex flex-wrap gap-2 mb-5">
          {([
            { value: 'classic'  as LabelStyle, label: 'Classic',  sub: 'Uppercase serif' },
            { value: 'elegant'  as LabelStyle, label: 'Elegant',  sub: 'Italic serif, gold' },
            { value: 'modern'   as LabelStyle, label: 'Modern',   sub: 'Bold sans-serif' },
            { value: 'refined'  as LabelStyle, label: 'Refined',  sub: 'Double border' },
            { value: 'minimal'  as LabelStyle, label: 'Minimal',  sub: 'No decoration' },
            { value: 'rustic'   as LabelStyle, label: 'Rustic',   sub: 'Warm earthy serif' },
            { value: 'bold'     as LabelStyle, label: 'Bold',     sub: 'Oversized name' },
          ]).map(({ value, label, sub }) => (
            <button
              key={value}
              onClick={() => setLabelStyle(value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                labelStyle === value
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
              }`}
            >
              {label}
              <span className={`block text-[11px] font-normal mt-0.5 ${labelStyle === value ? 'text-gray-300' : 'text-gray-400'}`}>
                {sub}
              </span>
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex gap-4" style={{ minHeight: 560 }}>

          {/* Left: item checklist */}
          <div className="w-72 flex-shrink-0 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">
                Menu Items
                {labelEntries.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-blue-600">{labelEntries.length} card{labelEntries.length !== 1 ? 's' : ''}</span>
                )}
              </span>
              {labelEntries.length > 0 && (
                <button onClick={() => setLabelEntries([])} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {/* Add custom item */}
            <div className="border-b border-gray-100">
              <div className="px-3 py-2.5 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Add Custom Item</p>
                <input
                  type="text"
                  placeholder="Item name *"
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={customDesc}
                  onChange={e => setCustomDesc(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomItem()}
                  className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
                />
                <button
                  onClick={addCustomItem}
                  disabled={!customName.trim()}
                  className="w-full py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Add to Labels
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-3 py-2.5 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search items…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent placeholder:text-gray-400"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
              ) : groups.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">
                  {search ? `No items matching "${search}"` : 'No items found'}
                </div>
              ) : (
                groups.map(({ category, items }) => {
                  const allOn = items.every(i => labelEntries.some(e => e.itemId === i.id));
                  const isCollapsed = collapsed.has(category);
                  return (
                    <div key={category} className="border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between px-4 py-2 bg-gray-50/80">
                        <button
                          onClick={() => toggleCollapse(category)}
                          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-800 transition-colors"
                        >
                          {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {category}
                          <span className="font-normal text-gray-400 ml-0.5">({items.length})</span>
                        </button>
                        <button onClick={() => toggleGroup(items)} className="text-[11px] text-blue-600 hover:text-blue-800 font-medium transition-colors">
                          {allOn ? 'Clear' : 'All'}
                        </button>
                      </div>
                      {(!isCollapsed || q) && items.map(item => {
                        const itemEntries = labelEntries.filter(e => e.itemId === item.id);
                        const isChecked = itemEntries.length > 0;
                        return (
                          <div key={item.id} className="border-b border-gray-50/60 last:border-0">
                            <label className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggle(item.id)}
                                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-gray-900 cursor-pointer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800 leading-tight">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-snug">{item.description}</p>
                                )}
                              </div>
                              {customIdSet.has(item.id) && (
                                <button
                                  type="button"
                                  onClick={e => { e.preventDefault(); removeCustomItem(item.id); }}
                                  className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
                                  title="Delete custom item"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </label>

                            {/* One protein row per entry (instance) */}
                            {isChecked && (
                              <div className="px-4 pb-2.5 space-y-1.5 -mt-1">
                                {itemEntries.map((entry, idx) => (
                                  <div key={entry.instanceId} className="space-y-1.5">
                                    {itemEntries.length > 1 && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-400 font-medium">
                                          Card {idx + 1}{entry.protein ? ` · ${entry.protein}` : ''}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => removeEntry(entry.instanceId)}
                                          className="text-gray-300 hover:text-red-400 transition-colors"
                                        >
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                      {PROTEINS.map(p => (
                                        <button
                                          key={p}
                                          type="button"
                                          onClick={() => selectProtein(entry.instanceId, p)}
                                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                                            entry.protein === p
                                              ? 'bg-gray-900 text-white border-gray-900'
                                              : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
                                          }`}
                                        >
                                          {p}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => addInstance(item.id)}
                                  className="text-[10px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                                >
                                  + Add another protein
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* Right: preview */}
          <div className="flex-1 bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex items-center px-4 py-3 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Preview</span>
              {labelEntries.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  {labelEntries.length} card{labelEntries.length !== 1 ? 's' : ''} · {pages.length} page{pages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {labelEntries.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                  <Printer className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-600">No items selected</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                  Check items on the left to preview tent cards
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto bg-gray-100 p-5 space-y-5">
                {pages.map((group, pi) => (
                  <div key={pi}>
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Page {pi + 1}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.map(entry => {
                        const item = allItems.find(i => i.id === entry.itemId);
                        if (!item) return null;
                        const isEditing = editingInstanceId === entry.instanceId;
                        const displayItem = {
                          ...item,
                          name: entry.customName || item.name,
                          description: entry.customDesc !== undefined ? entry.customDesc : item.description,
                        };
                        return (
                          <div key={entry.instanceId} className={`rounded overflow-hidden border transition-colors ${isEditing ? 'border-blue-300 shadow-sm' : 'border-transparent shadow-sm'}`}>
                            {/* Card preview with pencil button */}
                            <div className="relative group">
                              <PreviewCard item={displayItem} labelStyle={labelStyle} protein={entry.protein || undefined} />
                              <button
                                type="button"
                                onClick={() => setEditingInstanceId(isEditing ? null : entry.instanceId)}
                                className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-all ${
                                  isEditing
                                    ? 'bg-blue-600 text-white opacity-100'
                                    : 'bg-white/80 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-blue-600'
                                }`}
                                title={isEditing ? 'Done editing' : 'Edit label text'}
                              >
                                {isEditing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                              </button>
                            </div>
                            {/* Edit inputs */}
                            {isEditing && (
                              <div className="p-2 bg-blue-50 border-t border-blue-200 space-y-1.5">
                                <input
                                  type="text"
                                  value={entry.customName ?? item.name}
                                  onChange={e => updateEntryText(entry.instanceId, 'customName', e.target.value)}
                                  placeholder="Label name"
                                  className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                />
                                <textarea
                                  value={entry.customDesc ?? item.description}
                                  onChange={e => updateEntryText(entry.instanceId, 'customDesc', e.target.value)}
                                  placeholder="Description (optional)"
                                  rows={2}
                                  className="w-full px-2.5 py-1.5 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white resize-none"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-center text-gray-400 pb-2">
                  Fold along the center line · 4 cards per printed page
                </p>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Print-only layout ─────────────────────────────────── */}
      <div id="label-print-root" className="hidden print:block">
        {pages.map((group, pi) => (
          <div key={pi} className="print-page">
            {chunk(group, 2).map((row, ri) => (
              <React.Fragment key={ri}>
                {ri > 0 && <div className="print-row-cut" />}
                <div className="print-row">
                  {row.map(entry => {
                    const item = allItems.find(i => i.id === entry.itemId);
                    if (!item) return null;
                    const displayItem = {
                      ...item,
                      name: entry.customName || item.name,
                      description: entry.customDesc !== undefined ? entry.customDesc : item.description,
                    };
                    return (
                      <TentCard key={entry.instanceId} item={displayItem} labelStyle={labelStyle} protein={entry.protein || undefined} />
                    );
                  })}
                </div>
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>

    </AdminLayout>
  );
}
