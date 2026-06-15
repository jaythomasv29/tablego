'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Calendar, Clock, CalendarDays, Utensils, BookText,
  MessageSquare, Flag, Settings, Users, Package, Eye, EyeOff, Printer, UserX, MessageSquareHeart,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

const HIDEABLE = ['inventory', 'team', 'messages'];
const DEFAULT_HIDDEN = ['inventory', 'team', 'messages'];

const NAV_GROUPS = [
  {
    label: null as string | null,
    items: [
      { id: 'dashboard',    href: '/admin/home',         label: 'Dashboard',         icon: Home },
      { id: 'reservations', href: '/admin/reservation',  label: 'Reservations',      icon: CalendarDays },
    ],
  },
  {
    label: 'Operations',
    items: [
      { id: 'team',          href: '/admin/team',          label: 'Team View',          icon: Users },
      { id: 'inventory',     href: '/admin/inventory',     label: 'Inventory',          icon: Package },
      { id: 'hours',         href: '/admin/hours',         label: 'Hours',              icon: Clock },
      { id: 'special-dates', href: '/admin/special-dates', label: 'Business Holidays',  icon: Calendar },
      { id: 'cater',         href: '/admin/cater',         label: 'Catering',           icon: Utensils },
      { id: 'labeling',      href: '/admin/labeling',      label: 'Food Labels',        icon: Printer },
      { id: 'menu',          href: '/admin/menu',          label: 'Restaurant Menu',    icon: BookText },
      { id: 'messages',      href: '/admin/messages',      label: 'Messages',           icon: MessageSquare },
      { id: 'no-shows',      href: '/admin/no-shows',      label: 'No-Shows',           icon: UserX },
      { id: 'follow-ups',    href: '/admin/follow-ups',    label: 'Follow-Ups',         icon: MessageSquareHeart },
    ],
  },
  {
    label: 'Admin',
    items: [
      { id: 'banner',   href: '/admin/banner',   label: 'Banner',   icon: Flag },
      { id: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [hiddenLinks, setHiddenLinks] = useState<string[]>(DEFAULT_HIDDEN);

  useEffect(() => {
    const stored = localStorage.getItem('admin-hidden-links');
    if (stored !== null) {
      try { setHiddenLinks(JSON.parse(stored)); } catch {}
    }
  }, []);

  const toggleLink = (id: string) => {
    setHiddenLinks((prev) => {
      const next = prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id];
      localStorage.setItem('admin-hidden-links', JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const q = query(collection(db, 'messages'), where('status', '==', 'unread'));
        const snapshot = await getDocs(q);
        setUnreadCount(snapshot.size);
      } catch {}
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4 border-b border-sidebar-border">
        <p className="text-base font-bold text-sidebar-foreground">Admin Panel</p>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group, gi) => (
          <SidebarGroup key={gi}>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map(({ id, href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  const isHideable = HIDEABLE.includes(id);
                  const isHidden = hiddenLinks.includes(id);
                  const badge = id === 'messages' && unreadCount > 0 ? unreadCount : undefined;

                  return (
                    <SidebarMenuItem key={id}>
                      {isHidden ? (
                        <SidebarMenuButton
                          tooltip={label}
                          disabled
                          className="opacity-35 cursor-not-allowed"
                        >
                          <Icon />
                          <span>{label}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={label}
                        >
                          <Link href={href}>
                            <Icon />
                            <span>{label}</span>
                          </Link>
                        </SidebarMenuButton>
                      )}

                      {badge !== undefined && (
                        <SidebarMenuBadge>{badge}</SidebarMenuBadge>
                      )}

                      {isHideable && (
                        <SidebarMenuAction
                          showOnHover
                          onClick={() => toggleLink(id)}
                          title={isHidden ? `Show ${label}` : `Hide ${label}`}
                        >
                          {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </SidebarMenuAction>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#A3B18A] text-white font-semibold text-sm select-none">
            T
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold text-sidebar-foreground truncate">Thaiphoon Restaurant</span>
            <span className="text-xs text-sidebar-foreground/50 truncate">Admin Panel</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
