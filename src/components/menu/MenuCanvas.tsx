"use client";

import Image from "next/image";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { Check, Maximize, Minus, Plus } from "lucide-react";
import { MENU_DISHES, MENU_PAGE_SIZE, type MenuArea, type MenuDish } from "@/lib/menu/catalog";

// Pages are rendered from the legal-size print menu (8.5in × 14in = 612 × 1008pt).
// Regenerate with scripts/render-menu-pages.swift, then scripts/build-menu-catalog.mjs.
export const MENU_PAGES = [
  { src: "/images/menu/page-1.jpg", label: "Starters, Soup & Salad" },
  { src: "/images/menu/page-2.jpg", label: "Mains & Sides" },
] as const;

const PAGE_W = MENU_PAGE_SIZE.width;
const PAGE_H = MENU_PAGE_SIZE.height;
const GAP = 48;
const SPREAD_W = PAGE_W * MENU_PAGES.length + GAP * (MENU_PAGES.length - 1);
const PAD = 16;
const MAX_SCALE = 4;
const TAP_SLOP = 6;
// Page zoom used by the Page buttons on desktop (612pt page ≈ 860px wide).
const READABLE_SCALE = 1.4;

type View = { x: number; y: number; s: number };
type Target = "all" | number;

export type MenuSelectionMode = {
  selected: ReadonlySet<string>;
  onToggle: (dish: MenuDish) => void;
};
export type MenuCanvasHandle = { reveal: (dishId: string) => void };

function pageLeft(index: number) {
  return index * (PAGE_W + GAP);
}
function spreadX(area: MenuArea) {
  return pageLeft(area.page - 1) + area.x;
}

const MenuCanvas = forwardRef<MenuCanvasHandle, { className?: string; selection?: MenuSelectionMode }>(function MenuCanvas(
  { className = "", selection },
  ref,
) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 0.5 });
  // null until first measured: desktop opens on both pages, phones on page 1.
  const [target, setTarget] = useState<Target | null>(null);
  const homeTarget = (): Target => target ?? (size.w >= 768 ? "all" : 0);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; dist: number; mid: { x: number; y: number }; start: { x: number; y: number } } | null>(null);
  // True once the current press has moved far enough to be a drag; suppresses the dish tap.
  const moved = useRef(false);

  // Smallest scale where the whole spread still fits; zooming out further is pointless.
  const minScale = size.w ? Math.min((size.w - PAD * 2) / SPREAD_W, (size.h - PAD * 2) / PAGE_H) : 0.1;

  const clamp = useCallback(
    (v: View): View => {
      if (!size.w) return v;
      const s = Math.min(MAX_SCALE, Math.max(minScale, v.s));
      const cw = SPREAD_W * s;
      const ch = PAGE_H * s;
      const axis = (pos: number, content: number, port: number) =>
        content + PAD * 2 <= port ? (port - content) / 2 : Math.min(PAD, Math.max(port - content - PAD, pos));
      return { s, x: axis(v.x, cw, size.w), y: axis(v.y, ch, size.h) };
    },
    [size, minScale],
  );

  const fitTo = useCallback(
    (t: Target) => {
      if (!size.w) return;
      setTarget(t);
      if (t === "all") {
        setView(clamp({ s: minScale, x: 0, y: 0 }));
        return;
      }
      // Zoom into the chosen page: full width on phones; on wider screens a readable size that is
      // always larger than the both-pages view, so the button visibly focuses that page.
      const fitW = (size.w - PAD * 2) / PAGE_W;
      const fitH = (size.h - PAD * 2) / PAGE_H;
      const spreadFit = (size.w - PAD * 2) / SPREAD_W;
      const s = size.w < 768 ? fitW : Math.min(fitW, Math.max(fitH, READABLE_SCALE, spreadFit * 1.15));
      setView(clamp({ s, x: (size.w - PAGE_W * s) / 2 - pageLeft(t) * s, y: PAD }));
    },
    [size, minScale, clamp],
  );

  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      setView(v => {
        const s = Math.min(MAX_SCALE, Math.max(minScale, v.s * factor));
        const k = s / v.s;
        return clamp({ s, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
      });
    },
    [minScale, clamp],
  );

  // Pan so an area is fully visible, zooming in to a readable size if needed.
  const revealArea = useCallback(
    (area: MenuArea, center = false) => {
      setView(v => {
        const s = Math.max(v.s, Math.min(1.1, (size.w - PAD * 2) / (area.w + 24)));
        const left = spreadX(area) * s, top = area.y * s, right = left + area.w * s, bottom = top + area.h * s;
        let x = v.s === s ? v.x : size.w / 2 - (left + right) / 2;
        let y = v.s === s ? v.y : size.h / 2 - (top + bottom) / 2;
        if (center) { x = size.w / 2 - (left + right) / 2; y = size.h / 2 - (top + bottom) / 2; }
        if (x + left < PAD) x = PAD - left;
        if (x + right > size.w - PAD) x = size.w - PAD - right;
        if (y + top < PAD) y = PAD - top;
        if (y + bottom > size.h - 72) y = size.h - 72 - bottom;
        return clamp({ s, x, y });
      });
      setTarget(area.page - 1);
    },
    [size, clamp],
  );

  useImperativeHandle(ref, () => ({
    reveal: (dishId: string) => {
      const dish = MENU_DISHES.find(d => d.id === dishId);
      if (dish) revealArea(dish.areas[0], true);
    },
  }), [revealArea]);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-fit on first measure and whenever the viewport resizes.
  const lastSize = useRef("");
  useEffect(() => {
    const key = `${size.w}x${size.h}`;
    if (!size.w || key === lastSize.current) return;
    lastSize.current = key;
    fitTo(target ?? (size.w >= 768 ? "all" : 0));
  }, [size, target, fitTo]);

  // Wheel: trackpad pinch / ctrl+wheel zooms, plain wheel pans. Non-passive to stop page scroll.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setView(v => clamp({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, clamp]);

  const local = (e: React.PointerEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const beginGesture = () => {
    const pts = Array.from(pointers.current.values());
    const mid = pts.length > 1 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const dist = pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesture.current = pts.length ? { view, dist, mid, start: mid } : null;
  };

  // Pointer capture starts only once a press becomes a drag, so a plain tap still clicks the dish under it.
  const capture = () => {
    const el = viewportRef.current;
    if (!el) return;
    pointers.current.forEach((_, id) => { try { el.setPointerCapture(id); } catch { /* pointer already released */ } });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) moved.current = false;
    else { moved.current = true; capture(); }
    beginGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const pts = Array.from(pointers.current.values());
    const g = gesture.current;
    if (pts.length > 1 && g.dist) {
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const s = Math.min(MAX_SCALE, Math.max(minScale, g.view.s * (dist / g.dist)));
      const k = s / g.view.s;
      setView(clamp({ s, x: mid.x - (g.mid.x - g.view.x) * k, y: mid.y - (g.mid.y - g.view.y) * k }));
    } else {
      const dx = pts[0].x - g.start.x;
      const dy = pts[0].y - g.start.y;
      if (!moved.current && Math.abs(dx) + Math.abs(dy) > TAP_SLOP) {
        moved.current = true;
        setDragging(true);
        capture();
      }
      if (moved.current) setView(clamp({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) setDragging(false);
    beginGesture();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (selection && (e.target as HTMLElement).closest("[data-dish]")) return;
    const rect = viewportRef.current!.getBoundingClientRect();
    if (view.s >= MAX_SCALE * 0.6) fitTo(homeTarget());
    else zoomAt(2, e.clientX - rect.left, e.clientY - rect.top);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    const step = 80;
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step],
    };
    if (pan[e.key]) {
      e.preventDefault();
      setView(v => clamp({ ...v, x: v.x + pan[e.key][0], y: v.y + pan[e.key][1] }));
    } else if (e.key === "+" || e.key === "=") {
      zoomAt(1.25, size.w / 2, size.h / 2);
    } else if (e.key === "-") {
      zoomAt(0.8, size.w / 2, size.h / 2);
    } else if (e.key === "0") {
      fitTo(homeTarget());
    }
  };

  const btn =
    "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-40";
  const idle = "text-zinc-700 hover:bg-zinc-100";
  const active = "bg-zinc-900 text-white hover:bg-zinc-800";

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#e9e4d8] ${className}`}>
      {selection && (
        <style>{`@keyframes menu-dish-hint{0%,100%{background:transparent;box-shadow:none}35%{background:rgba(163,177,138,.22);box-shadow:inset 0 0 0 1.5px rgba(95,122,58,.55)}}`}</style>
      )}
      <div
        ref={viewportRef}
        role="region"
        aria-label={
          selection
            ? "Menu. Tap a dish to add or remove it. Drag to move, pinch or use the zoom buttons to zoom."
            : "Menu. Drag to move, pinch or use the zoom buttons to zoom. Arrow keys pan, plus and minus zoom, 0 resets."
        }
        tabIndex={0}
        className={`absolute inset-0 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 ${dragging ? "cursor-grabbing" : selection ? "cursor-default" : "cursor-grab"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: SPREAD_W,
            height: PAGE_H,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
            visibility: size.w ? "visible" : "hidden",
          }}
        >
          {MENU_PAGES.map((page, i) => (
            <Image
              key={page.src}
              src={page.src}
              alt={`Menu page ${i + 1}: ${page.label}`}
              width={PAGE_W}
              height={PAGE_H}
              unoptimized
              priority={i === 0}
              draggable={false}
              className="absolute top-0 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.35)]"
              style={{ left: pageLeft(i), width: PAGE_W, height: PAGE_H, maxWidth: "none" }}
            />
          ))}

          {selection &&
            MENU_DISHES.map(dish => {
              const picked = selection.selected.has(dish.id);
              return dish.areas.map((area, index) => (
                <button
                  key={`${dish.id}-${index}`}
                  type="button"
                  data-dish={dish.id}
                  // Photos repeat the dish's text button, so only the text area is in the tab order.
                  tabIndex={index ? -1 : 0}
                  aria-hidden={index ? true : undefined}
                  aria-pressed={index ? undefined : picked}
                  aria-label={index ? undefined : `${dish.name}, ${dish.section}, ${dish.price}`}
                  onClick={() => { if (!moved.current) selection.onToggle(dish); }}
                  onFocus={index ? undefined : e => { if (e.currentTarget.matches(":focus-visible")) revealArea(area); }}
                  className={`group absolute rounded-md outline-none transition-[background-color,box-shadow] duration-150 focus-visible:ring-[3px] focus-visible:ring-zinc-900 ${
                    picked
                      ? "bg-[rgba(163,177,138,0.30)] shadow-[inset_0_0_0_2.5px_#5f7a3a]"
                      : "hover:bg-[rgba(163,177,138,0.16)] hover:shadow-[inset_0_0_0_1.5px_rgba(95,122,58,0.6)]"
                  }`}
                  style={{
                    left: spreadX(area), top: area.y, width: area.w, height: area.h,
                    animation: picked ? undefined : `menu-dish-hint 1.6s ease-in-out ${0.4 + (area.y / PAGE_H) * 0.6}s 1`,
                  }}
                >
                  {picked && index === 0 && (
                    <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#5f7a3a] text-white shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                  )}
                </button>
              ));
            })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/90 p-1 shadow-lg backdrop-blur">
          {MENU_PAGES.map((page, i) => (
            <button
              key={page.src}
              type="button"
              onClick={() => fitTo(i)}
              aria-pressed={target === i}
              title={page.label}
              className={`${btn} ${target === i ? active : idle}`}
            >
              Page {i + 1}
            </button>
          ))}
          <button
            type="button"
            onClick={() => fitTo("all")}
            aria-pressed={target === "all"}
            aria-label="Show both pages"
            title="Show both pages"
            className={`${btn} ${target === "all" ? active : idle}`}
          >
            <Maximize className="h-4 w-4" />
          </button>
          <div className="mx-1 h-5 w-px bg-zinc-200" />
          <button type="button" onClick={() => zoomAt(0.8, size.w / 2, size.h / 2)} disabled={view.s <= minScale + 0.001} aria-label="Zoom out" className={`${btn} ${idle}`}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-11 text-center text-xs tabular-nums text-zinc-500" aria-live="polite">
            {Math.round(view.s * 100)}%
          </span>
          <button type="button" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)} disabled={view.s >= MAX_SCALE - 0.001} aria-label="Zoom in" className={`${btn} ${idle}`}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default MenuCanvas;
