"use client";

import Image from "next/image";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus } from "lucide-react";

// Pages are rendered from the legal-size print menu (8.5in × 14in = 612 × 1008pt).
// Regenerate with: swift scripts/render-menu-pages.swift <menu.pdf> public/images/menu
export const MENU_PAGES = [
  { src: "/images/menu/page-1.jpg", label: "Starters, Soup & Salad" },
  { src: "/images/menu/page-2.jpg", label: "Mains & Sides" },
] as const;

const PAGE_W = 612;
const PAGE_H = 1008;
const GAP = 48;
const SPREAD_W = PAGE_W * MENU_PAGES.length + GAP * (MENU_PAGES.length - 1);
const PAD = 16;
const MAX_SCALE = 4;

type View = { x: number; y: number; s: number };
type Target = "all" | number;

function pageLeft(index: number) {
  return index * (PAGE_W + GAP);
}

export default function MenuCanvas({ className = "" }: { className?: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ x: 0, y: 0, s: 0.5 });
  const [target, setTarget] = useState<Target>(0);
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ view: View; dist: number; mid: { x: number; y: number }; start: { x: number; y: number } } | null>(null);
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
      // Fit page width on narrow screens, whole page on wide ones.
      const fitW = (size.w - PAD * 2) / PAGE_W;
      const fitH = (size.h - PAD * 2) / PAGE_H;
      const s = size.w < 768 ? fitW : Math.min(fitW, fitH);
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
    fitTo(target);
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

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    setDragging(true);
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
      moved.current = true;
      setView(clamp({ s, x: mid.x - (g.mid.x - g.view.x) * k, y: mid.y - (g.mid.y - g.view.y) * k }));
    } else {
      const dx = pts[0].x - g.start.x;
      const dy = pts[0].y - g.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      setView(clamp({ s: g.view.s, x: g.view.x + dx, y: g.view.y + dy }));
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) setDragging(false);
    beginGesture();
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const rect = viewportRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    if (view.s >= MAX_SCALE * 0.6) fitTo(target);
    else zoomAt(2, px, py);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
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
      fitTo(target);
    }
  };

  const btn =
    "flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-40";
  const idle = "text-zinc-700 hover:bg-zinc-100";
  const active = "bg-zinc-900 text-white hover:bg-zinc-800";

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#e9e4d8] ${className}`}>
      <div
        ref={viewportRef}
        role="region"
        aria-label="Menu. Drag to move, pinch or use the zoom buttons to zoom. Arrow keys pan, plus and minus zoom, 0 resets."
        tabIndex={0}
        className={`absolute inset-0 touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
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
}
