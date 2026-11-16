'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, LocateFixed, Trash2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import MenuCanvas, { type MenuCanvasHandle } from '@/components/menu/MenuCanvas';
import { DISH_NOTE_LIMIT, MAX_CATERING_DISHES, groupDishesBySection, menuDish, type DishSelection, type MenuDish } from '@/lib/menu/catalog';

const ACCENT = '#A3B18A';
const field = 'w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#A3B18A]';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: DishSelection[];
  onChange: (value: DishSelection[]) => void;
};

/** Full-screen print menu where guests tap dishes to build a catering request. */
export default function MenuDishPicker({ open, onOpenChange, value, onChange }: Props) {
  const canvas = useRef<MenuCanvasHandle>(null);
  const [status, setStatus] = useState<{ text: string; key: number } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recent, setRecent] = useState('');
  const selected = useMemo(() => new Set(value.map(item => item.id)), [value]);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), 2200);
    return () => clearTimeout(timer);
  }, [status]);

  // Bring the dish just added into view in the list.
  useEffect(() => {
    if (!recent) return;
    for (const prefix of ['panel', 'sheet']) document.getElementById(`${prefix}-picked-${recent}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [recent]);

  const announce = (text: string) => setStatus({ text, key: Date.now() });

  const toggle = (dish: MenuDish) => {
    if (selected.has(dish.id)) {
      onChange(value.filter(item => item.id !== dish.id));
      announce(`Removed ${dish.name}`);
      return;
    }
    if (value.length >= MAX_CATERING_DISHES) {
      announce(`You can choose up to ${MAX_CATERING_DISHES} dishes`);
      return;
    }
    onChange([...value, { id: dish.id }]);
    setRecent(dish.id);
    announce(dish.choices.length ? `Added ${dish.name} · choose an option below` : `Added ${dish.name}`);
  };

  const update = (id: string, patch: Partial<DishSelection>) =>
    onChange(value.map(item => (item.id === id ? { ...item, ...patch } : item)));

  const groups = groupDishesBySection(value.flatMap(item => {
    const dish = menuDish(item.id);
    return dish ? [{ ...item, dish, section: dish.section }] : [];
  }));
  const count = value.length;
  const needsChoice = value.filter(item => menuDish(item.id)?.choices.length && !item.choice).length;

  const renderList = (prefix: string) => (
    <div className="space-y-5">
      {!count && (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
          Tap any dish on the menu to add it to your catering request.
        </p>
      )}
      {groups.map(({ section, items }) => (
        <section key={section}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{section}</h3>
          <ul className="space-y-2">
            {items.map(({ dish, ...item }) => (
              <li
                key={dish.id}
                id={`${prefix}-picked-${dish.id}`}
                className={`rounded-2xl border bg-white p-3 transition-shadow ${recent === dish.id ? 'border-[#5f7a3a] shadow-[0_0_0_3px_rgba(163,177,138,0.35)]' : 'border-zinc-200'}`}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-snug text-zinc-900">{dish.name}</p>
                    <p className="text-xs text-zinc-500">{dish.price}{dish.gf ? ' · Gluten-free' : ''}</p>
                  </div>
                  <button type="button" onClick={() => { canvas.current?.reveal(dish.id); setSheetOpen(false); }} className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label={`Show ${dish.name} on the menu`} title="Show on menu">
                    <LocateFixed className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => toggle(dish)} className="rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${dish.name}`} title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {dish.choices.length > 0 && (
                  <label className="mt-2 block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600">Option</span>
                    <select
                      className={`${field} ${!item.choice ? 'border-amber-300 bg-amber-50/60' : ''}`}
                      value={item.choice || ''}
                      onChange={e => update(dish.id, { choice: e.target.value })}
                    >
                      <option value="">Choose an option…</option>
                      {dish.choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
                    </select>
                  </label>
                )}

                {dish.addOns.length > 0 && (
                  <fieldset className="mt-2">
                    <legend className="mb-1 text-xs font-medium text-zinc-600">Add-ons</legend>
                    {dish.addOns.map(addOn => {
                      const on = item.addOns?.includes(addOn) ?? false;
                      return (
                        <label key={addOn} className="flex items-center gap-2 py-0.5 text-sm text-zinc-700">
                          <input
                            type="checkbox"
                            checked={on}
                            className="h-4 w-4 accent-[#5f7a3a]"
                            onChange={() => update(dish.id, { addOns: on ? item.addOns?.filter(a => a !== addOn) : [...(item.addOns || []), addOn] })}
                          />
                          {addOn}
                        </label>
                      );
                    })}
                  </fieldset>
                )}

                <label className="mt-2 block">
                  <span className="sr-only">Note for {dish.name}</span>
                  <input
                    className={field}
                    value={item.note || ''}
                    maxLength={DISH_NOTE_LIMIT}
                    placeholder="Note (optional) — e.g. mild, no peanuts"
                    onChange={e => update(dish.id, { note: e.target.value })}
                  />
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  const done = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      className="rounded-full px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-opacity hover:opacity-90"
      style={{ backgroundColor: ACCENT }}
    >
      Done{count ? ` · ${count}` : ''}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 [background:#F9F7F2] [color:#18181b] sm:max-w-none md:flex-row"
        style={{ fontFamily: 'var(--font-sans), sans-serif' }}
      >
        {/* Menu */}
        <div className="relative flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-[#F9F7F2] px-4 py-3">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold text-zinc-900">Build your catering menu</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">Tap a dish to add it · tap again to remove</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="md:hidden">{done}</span>
              <button type="button" onClick={() => onOpenChange(false)} className="hidden rounded-full p-2 text-zinc-500 hover:bg-zinc-200/60 md:block" aria-label="Close menu">
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>
          <div className="relative min-h-0 flex-1 p-2 pb-16 md:pb-2">
            <MenuCanvas ref={canvas} className="h-full" selection={{ selected, onToggle: toggle }} />
            <div aria-live="polite" className="pointer-events-none absolute inset-x-0 top-5 flex justify-center px-4">
              {status && (
                <p key={status.key} className="rounded-full bg-zinc-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg animate-in fade-in-0 slide-in-from-top-2">
                  {status.text}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Selections — side panel on desktop */}
        <aside className="hidden w-[380px] shrink-0 flex-col border-l border-zinc-200 bg-[#F4F1E8] md:flex">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Your selections</h2>
              <p className="text-xs text-zinc-500">
                {count} of {MAX_CATERING_DISHES} dishes{needsChoice ? ` · ${needsChoice} need${needsChoice === 1 ? 's' : ''} an option` : ''}
              </p>
            </div>
            {count > 0 && <button type="button" onClick={() => onChange([])} className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline">Clear all</button>}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{renderList('panel')}</div>
          <div className="border-t border-zinc-200 p-4">
            <p className="mb-3 text-xs text-zinc-500">Prices are per dish as printed. Your catering quote is confirmed by our team.</p>
            <div className="flex justify-end">{done}</div>
          </div>
        </aside>

        {/* Selections — bottom sheet on phones */}
        <div className={`absolute inset-x-0 bottom-0 z-10 flex flex-col rounded-t-3xl border-t border-zinc-200 bg-[#F4F1E8] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.3)] transition-[max-height] duration-300 md:hidden ${sheetOpen ? 'max-h-[75dvh]' : 'max-h-14'}`}>
          <button type="button" onClick={() => setSheetOpen(o => !o)} aria-expanded={sheetOpen} className="flex h-14 shrink-0 items-center justify-between px-5 text-left">
            <span className="text-sm font-semibold text-zinc-900">
              {count ? `${count} ${count === 1 ? 'dish' : 'dishes'} selected` : 'No dishes yet'}
              {needsChoice ? <span className="ml-2 text-xs font-normal text-amber-700">{needsChoice} need{needsChoice === 1 ? 's' : ''} an option</span> : null}
            </span>
            <ChevronUp className={`h-5 w-5 text-zinc-500 transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
          </button>
          {sheetOpen && <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{renderList('sheet')}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
