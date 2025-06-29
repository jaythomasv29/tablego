'use client';

import { useEffect, useState } from 'react';
import AdminSideBar from './AdminSideBar';
import { RefreshCw } from 'lucide-react';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isRefreshing, setIsRefreshing] = useState(false);

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
        <div className="min-h-screen bg-gray-100 flex">
            <AdminSideBar />
            <div className="flex-1 flex flex-col">
                {/* Force Refresh Button */}
                <div className="bg-white border-b border-gray-200 px-4 py-2 flex justify-end">
                    <button
                        onClick={forceRefresh}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors disabled:opacity-50"
                        title="Force refresh page (Ctrl+Shift+R)"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        {isRefreshing ? 'Refreshing...' : 'Force Refresh'}
                    </button>
                </div>

                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    );
}