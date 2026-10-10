'use client';

import { useEffect, useState } from 'react';
import AdminSideBar from './AdminSideBar';
import { RefreshCw, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { signOut } from 'firebase/auth';
import { auth } from '@/firebase';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => { setMounted(true); }, []);

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
    if ('caches' in window) {
      caches.keys().then(names => names.forEach(name => caches.delete(name)));
    }
    localStorage.clear();
    sessionStorage.clear();
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
    <SidebarProvider className="h-screen overflow-hidden">
      <AdminSideBar />
      <SidebarInset className="overflow-hidden flex flex-col">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-4 py-2 flex items-center justify-between shrink-0">
          <SidebarTrigger className="text-muted-foreground" />
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
                {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={forceRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 text-muted-foreground"
              title="Force refresh page (Ctrl+Shift+R)"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
