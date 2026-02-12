'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    Calendar,
    Clock,
    CalendarDays,
    Utensils,
    X,
    Menu,
    BookText,
    MessageSquare,
    Flag,
    Settings,
    Users
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

export default function AdminSidebar() {
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Fetch unread messages count
    useEffect(() => {
        const fetchUnreadCount = async () => {
            try {
                const q = query(
                    collection(db, 'messages'),
                    where('status', '==', 'unread')
                );
                const snapshot = await getDocs(q);
                setUnreadCount(snapshot.size);
            } catch (error) {
                console.error('Error fetching unread messages:', error);
            }
        };

        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, []);

    const links = [
        { href: '/admin/home', label: 'Dashboard', icon: Home },
        { href: '/admin/reservation', label: 'Reservations', icon: CalendarDays },
        { href: '/admin/team', label: 'Team View', icon: Users },
        { href: '/admin/hours', label: 'Hours', icon: Clock },
        { href: '/admin/special-dates', label: 'Business Holidays', icon: Calendar },
        { href: '/admin/cater', label: 'Catering', icon: Utensils },
        { href: '/admin/menu', label: 'Restaurant Menu', icon: BookText },
        {
            href: '/admin/messages',
            label: 'Messages',
            icon: MessageSquare,
            badge: unreadCount > 0 ? unreadCount : undefined
        },
        { href: '/admin/banner', label: 'Banner', icon: Flag },
        { href: '/admin/settings', label: 'Settings', icon: Settings },
    ];

    const NavLinks = () => (
        <ul className="space-y-2">
            {links.map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href;
                return (
                    <li key={href}>
                        <Link
                            href={href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Icon className="w-5 h-5" />
                            <span>{label}</span>
                            {badge !== undefined && (
                                <span className={`ml-auto px-2 py-1 text-xs rounded-full ${isActive ? 'bg-white text-blue-500' : 'bg-red-500 text-white'
                                    }`}>
                                    {badge}
                                </span>
                            )}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );

    return (
        <>
            {/* Mobile Menu Button */}
            <div className="lg:hidden fixed top-4 left-4 z-50">
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 rounded-lg bg-white shadow-md hover:bg-gray-50"
                >
                    {isMobileMenuOpen ? (
                        <X className="w-6 h-6 text-gray-600" />
                    ) : (
                        <Menu className="w-6 h-6 text-gray-600" />
                    )}
                </button>
            </div>

            {/* Mobile Sidebar */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-40">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl animate-slide-right">
                        <div className="p-4">
                            <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
                        </div>
                        <nav className="p-4">
                            <NavLinks />
                        </nav>
                    </div>
                </div>
            )}

            {/* Desktop Sidebar */}
            <div className="hidden lg:flex w-64 bg-white border-r h-screen sticky top-0 flex-col overflow-y-auto">
                <div className="p-4">
                    <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
                </div>
                <nav className="flex-1 p-4">
                    <NavLinks />
                </nav>
            </div>
        </>
    );
}