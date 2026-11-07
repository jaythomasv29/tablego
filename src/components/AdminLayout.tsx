'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import AdminSideBar from './AdminSideBar';
import { RefreshCw, Sun, Moon, Home, CalendarDays, ClipboardCheck, Package, Menu, Layers } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';
import { unlockAudio } from '@/utils/soundUtils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminShellContext = createContext(false);

export default function AdminLayout({ children }: AdminLayoutProps) {
  const insideShell = useContext(AdminShellContext);
  return insideShell ? <>{children}</> : <AdminShell>{children}</AdminShell>;
}

function AdminShell({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const content = useRef<HTMLDivElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const restoringScroll = useRef(false);
  useEffect(() => {
    const region = content.current;
    const target = scrollPositions.current.get(pathname) ?? 0;
    let observer: ResizeObserver | undefined;
    const stopRestoring = () => { restoringScroll.current = false; observer?.disconnect(); };
    const restore = () => {
      if (!region) return;
      region.scrollTop = target;
      if (Math.abs(region.scrollTop - target) < 1) stopRestoring();
    };
    restoringScroll.current = true;
    restore();
    // A returning page can still be loading. Restore once its content has room,
    // but let any deliberate user interaction take priority.
    if (restoringScroll.current && region?.firstElementChild && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(restore);
      observer.observe(region.firstElementChild);
    } else stopRestoring();
    region?.addEventListener('pointerdown', stopRestoring, { passive: true });
    region?.addEventListener('wheel', stopRestoring, { passive: true });
    region?.addEventListener('keydown', stopRestoring);
    const animation = reduced ? undefined : region?.animate?.([{ opacity: .7 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
    return () => {
      stopRestoring(); animation?.cancel();
      region?.removeEventListener('pointerdown', stopRestoring);
      region?.removeEventListener('wheel', stopRestoring);
      region?.removeEventListener('keydown', stopRestoring);
    };
  }, [pathname, reduced]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [appearance, setAppearance] = useState<'dark' | 'light'>('dark');
  const { setTheme: setGlobalTheme } = useTheme();
  useEffect(() => { setGlobalTheme(appearance); }, [appearance, setGlobalTheme]);
  const resolvedTheme = appearance;
  const setTheme = (next: 'dark' | 'light') => { setAppearance(next); try { localStorage.setItem('tablego-admin-appearance', next); } catch {} };

  useEffect(() => {
    setMounted(true);
    try { if (localStorage.getItem('tablego-admin-appearance') === 'light') setAppearance('light'); } catch {}
    window.addEventListener('pointerdown', unlockAudio); window.addEventListener('keydown', unlockAudio);
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'R') {
        event.preventDefault();
        forceRefresh();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const forceRefresh = () => {
    setIsRefreshing(true);
    window.location.reload();
  };

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Logout failed');
      await signOut(auth);
      window.location.assign('/login');
    } catch {
      setSigningOut(false);
      alert('Unable to sign out. Please try again.');
    }
  };

  return (
    <AdminShellContext.Provider value={true}><SidebarProvider mobileBreakpoint={1024} data-admin-console data-admin-appearance={appearance} className={`admin-console ${appearance === 'dark' ? 'dark' : ''} h-dvh overflow-hidden`}>
      <AdminSideBar />
      <SidebarInset className="admin-inset overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="admin-topbar">
          <div className="admin-topbar-brand"><SidebarTrigger className="admin-menu-trigger" /><Layers size={19} aria-hidden="true" /><Link href="/admin/home">TableGo<span>Restaurant workspace</span></Link></div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogout} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
            {mounted && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 text-muted-foreground"
                title="Toggle dark mode"
              >
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" aria-hidden="true" /> : <Moon className="w-4 h-4" aria-hidden="true" />}
                {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={forceRefresh}
              disabled={isRefreshing}
              className="admin-refresh flex items-center gap-2 text-muted-foreground"
              title="Refresh page (Ctrl+Shift+R)"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </header>

        <div ref={content} onScroll={event => { if (!restoringScroll.current) scrollPositions.current.set(pathname, event.currentTarget.scrollTop); }} id="admin-content" className="admin-scroll flex-1 overflow-y-auto">
          <div className="admin-page-surface">{children}</div>
        </div>
        <AdminQuickNav />
      </SidebarInset>
    </SidebarProvider></AdminShellContext.Provider>
  );
}

function AdminQuickNav() {
  const pathname = usePathname(), { toggleSidebar, openMobile } = useSidebar();
  const reduced = useReducedMotion();
  const links = [
    { href: '/admin/home', label: 'Today', icon: Home },
    { href: '/admin/reservation', label: 'Bookings', icon: CalendarDays },
    { href: '/admin/work', label: 'Work', icon: ClipboardCheck },
    { href: '/admin/inventory/manage', label: 'Stock', icon: Package },
  ];
  return <nav className="admin-quick-nav" aria-label="Quick navigation">
    {links.map(({ href, label, icon: Icon }) => {
      const active = href.includes('/inventory/') ? pathname.startsWith('/admin/inventory') : pathname === href;
      return <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
        {active && <motion.span
          className="admin-nav-highlight"
          layoutId="admin-nav-highlight"
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }}
          aria-hidden="true"
        />}
        <Icon size={20} aria-hidden="true" /><span>{label}</span>
      </Link>;
    })}
    <button type="button" aria-label="More admin pages" aria-expanded={openMobile} onClick={toggleSidebar}><Menu size={20} aria-hidden="true" /><span>More</span></button>
  </nav>;
}
