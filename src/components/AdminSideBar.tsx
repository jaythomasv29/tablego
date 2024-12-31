'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home,
    Calendar,
    Clock,
    Menu as MenuIcon,
    MessageCircle,
    Utensils
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

export default function AdminSidebar() {
    const pathname = usePathname();
    const [unreadCount, setUnreadCount] = useState(0);

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
        // Set up an interval to check for new messages
        const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, []);

    const links = [
        { href: '/admin/home', label: 'Dashboard', icon: Home },
        { href: '/admin/reservation', label: 'Reservations', icon: Calendar },
        { href: '/admin/hours', label: 'Hours', icon: Clock },
        { href: '/admin/menu', label: 'Menu', icon: MenuIcon },
        { href: '/admin/cater', label: 'Catering', icon: Utensils },
        {
            href: '/admin/messages',
            label: 'Messages',
            icon: MessageCircle,
            badge: unreadCount > 0 ? unreadCount : undefined
        },
    ];

    return (
        <div className="w-64 bg-white border-r h-screen flex flex-col">
            <div className="p-4">
                <h1 className="text-xl font-bold text-gray-800">Admin Panel</h1>
            </div>
            <nav className="flex-1 p-4">
                <ul className="space-y-2">
                    {links.map(({ href, label, icon: Icon, badge }) => {
                        const isActive = pathname === href;
                        return (
                            <li key={href}>
                                <Link
                                    href={href}
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
            </nav>
        </div>
    );
}