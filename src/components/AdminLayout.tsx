'use client';

import { useEffect, useState } from 'react';
import AdminSideBar from './AdminSideBar';
import { RefreshCw, PanelLeftClose, PanelLeftOpen, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(true);
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme, setTheme } = useTheme();

    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        const stored = localStorage.getItem('admin-sidebar-visible');
        if (stored !== null) setIsSidebarVisible(stored === 'true');
    }, []);

    useEffect(() => {
        localStorage.setItem('admin-sidebar-visible', String(isSidebarVisible));
    }, [isSidebarVisible]);

    // Add keyboard shortcut for force refresh
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Ctrl+Shift+R or Cmd+Shift+R for force refresh
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
        // Clear all caches and force reload
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }

        // Clear localStorage and sessionStorage
        localStorage.clear();
        sessionStorage.clear();

        // Force reload with cache bypass
        window.location.reload();
    };

    return (
        <div className="h-screen bg-gray-100 dark:bg-gray-900 flex overflow-hidden">
            {isSidebarVisible && <AdminSideBar />}
            <div className="flex-1 flex flex-col">
                {/* Top bar */}
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-between">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSidebarVisible(prev => !prev)}
                        className="flex items-center gap-2 text-gray-700 dark:text-gray-300"
                        title={isSidebarVisible ? 'Hide sidebar navigation' : 'Show sidebar navigation'}
                    >
                        {isSidebarVisible ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
                        {isSidebarVisible ? 'Hide Nav' : 'Show Nav'}
                    </Button>

                    <div className="flex items-center gap-2">
                        {mounted && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                                className="flex items-center gap-2 text-gray-700 dark:text-gray-300"
                                title="Toggle dark mode"
                            >
                                {resolvedTheme === 'dark' ? (
                                    <Sun className="w-4 h-4" />
                                ) : (
                                    <Moon className="w-4 h-4" />
                                )}
                                {resolvedTheme === 'dark' ? 'Light' : 'Dark'}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={forceRefresh}
                            disabled={isRefreshing}
                            className="flex items-center gap-2 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                            title="Force refresh page (Ctrl+Shift+R)"
                        >
                            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
                        </Button>
                    </div>
                </div>

                <main className="admin-main flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}