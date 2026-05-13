'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import AdminLayout from '@/components/AdminLayout';
import { Printer, ChevronDown, ChevronRight, Search, X } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: string;
}

type LabelStyle = 'classic' | 'elegant' | 'modern';

const RESTAURANT_NAME = 'Thaiphoon Restaurant · Palo Alto';

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
function TentCard({ item, labelStyle }: { item: MenuItem; labelStyle: LabelStyle }) {
  const isDividerLine = labelStyle === 'elegant' || labelStyle === 'modern';
  return (
    <div className={`tc tc-${labelStyle}`}>
      <div className="tc-back">
        <span className="tc-restaurant">{RESTAURANT_NAME}</span>
      </div>
      <div className="tc-fold" />
      <div className="tc-front">
        <p className="tc-name">{item.name}</p>
        {isDividerLine
          ? <div className="tc-divider" />
          : <span className="tc-divider">· · ·</span>
        }
        {item.description && <p className="tc-desc">{item.description}</p>}
        <span className="tc-footer">{RESTAURANT_NAME}</span>
      </div>
    </div>
  );
}

// ── Preview card — shows only the front face at screen scale ──────────────────
// Proportional to 3.5" × 2" (front half only)
function PreviewCard({ item, labelStyle }: { item: MenuItem; labelStyle: LabelStyle }) {
  const isDividerLine = labelStyle === 'elegant' || labelStyle === 'modern';
  // Inline size overrides to keep preview compact
  const frontStyle: React.CSSProperties = {
    height: 110,
    flex: 'none',
    padding: '0 14px',
    gap: 5,
  };
  const nameSize = labelStyle === 'modern' ? 12 : 13;
  return (
    <div
      className={`tc tc-${labelStyle}`}
      style={{
        height: 110,
        ...(labelStyle === 'elegant' ? { borderBottom: '1.5px solid #c8b89a', borderTop: 'none' } : {}),
        ...(labelStyle === 'modern' ? { borderTop: 'none', borderLeft: 'none' } : {}),
      }}
    >
      <div className="tc-front" style={frontStyle}>
        <p className="tc-name" style={{ fontSize: nameSize, letterSpacing: '0.06em' }}>{item.name}</p>
        {isDividerLine
          ? <div className="tc-divider" style={{ width: 24 }} />
          : <span className="tc-divider" style={{ fontSize: 8 }}>· · ·</span>
        }
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LabelingPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [customItems, setCustomItems] = useState<MenuItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelStyle, setLabelStyle] = useState<LabelStyle>('classic');
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');

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
  const filteredItems = q
    ? menuItems.filter(i => i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    : menuItems;
  const groups = groupAndSort(filteredItems);
  const selectedItems = allItems.filter(i => selectedIds.has(i.id));
  // 4 cards per page (2 columns × 2 rows)
  const pages = chunk(selectedItems, 4);

  const toggle = (id: string) =>
    setSelectedIds(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const toggleGroup = (items: MenuItem[]) => {
    const allOn = items.every(i => selectedIds.has(i.id));
    setSelectedIds(prev => {
      const s = new Set(prev);
      items.forEach(i => (allOn ? s.delete(i.id) : s.add(i.id)));
      return s;
    });
  };

  const addCustomItem = async () => {
    const name = customName.trim();
    if (!name) return;
    const desc = customDesc.trim();
    // Optimistic UI with temp ID
    const tempId = `custom-${Date.now()}`;
    setCustomItems(prev => [...prev, { id: tempId, name, description: desc, category: 'Custom' }]);
    setSelectedIds(prev => new Set(prev).add(tempId));
    setCustomName('');
    setCustomDesc('');
    // Persist to Firestore, swap temp ID for real doc ID
    try {
      const ref = await addDoc(collection(db, 'labelItems'), { name, description: desc, createdAt: Timestamp.now() });
      setCustomItems(prev => prev.map(i => i.id === tempId ? { ...i, id: ref.id } : i));
      setSelectedIds(prev => { const s = new Set(prev); s.delete(tempId); s.add(ref.id); return s; });
    } catch (err) {
      console.error('Failed to save custom item:', err);
    }
  };

  const removeCustomItem = async (id: string) => {
    setCustomItems(prev => prev.filter(i => i.id !== id));
    setSelectedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
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
            disabled={selectedItems.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print Labels{selectedItems.length > 0 ? ` (${selectedItems.length})` : ''}
          </button>
        </div>

        {/* Style picker */}
        <div className="flex flex-wrap gap-2 mb-5">
          {([
            { value: 'classic' as LabelStyle, label: 'Classic', sub: 'Uppercase serif' },
            { value: 'elegant' as LabelStyle, label: 'Elegant', sub: 'Italic serif, gold' },
            { value: 'modern'  as LabelStyle, label: 'Modern',  sub: 'Bold sans-serif' },
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
                {selectedIds.size > 0 && (
                  <span className="ml-2 text-xs font-normal text-blue-600">{selectedIds.size} selected</span>
                )}
              </span>
              {selectedIds.size > 0 && (
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">
                  Clear all
                </button>
              )}
            </div>

            {/* Add custom item */}
            <div className="border-b border-gray-100">
              {customItems.length > 0 && (
                <div className="px-4 pt-2.5 pb-1 bg-blue-50/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 mb-1.5">Custom</p>
                  {customItems.map(item => (
                    <div key={item.id} className="flex items-start justify-between gap-2 py-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 leading-tight">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-gray-400 leading-snug">{item.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => removeCustomItem(item.id)}
                        className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
                        title="Remove"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                  {search ? `No items matching "${search}"` : 'No menu items found'}
                </div>
              ) : (
                groups.map(({ category, items }) => {
                  const allOn = items.every(i => selectedIds.has(i.id));
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
                      {(!isCollapsed || q) && items.map(item => (
                        <label key={item.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50/60 last:border-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggle(item.id)}
                            className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-gray-900 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 leading-tight">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-snug">{item.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
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
              {selectedItems.length > 0 && (
                <span className="ml-2 text-xs text-gray-400">
                  {selectedItems.length} card{selectedItems.length !== 1 ? 's' : ''} · {pages.length} page{pages.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {selectedItems.length === 0 ? (
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
                    {/* 2-column grid matching the print layout */}
                    <div className="grid grid-cols-2 gap-2">
                      {group.map(item => (
                        <div key={item.id} className="shadow-sm rounded overflow-hidden">
                          <PreviewCard item={item} labelStyle={labelStyle} />
                        </div>
                      ))}
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
                  {row.map(item => (
                    <TentCard key={item.id} item={item} labelStyle={labelStyle} />
                  ))}
                </div>
              </React.Fragment>
            ))}
          </div>
        ))}
      </div>

    </AdminLayout>
  );
}
