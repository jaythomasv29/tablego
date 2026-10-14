'use client';

import { useTimezone } from '@/contexts/TimezoneContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, Calendar, Clock, CalendarDays, Utensils, BookText,
  MessageSquare, Mail, Flag, Settings, Users, Package, Eye, EyeOff, Printer, TrendingUp,
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
let mailingBadge: { value: number; fetchedAt: number } | null = null;

const NAV_GROUPS = [
  { label: 'Today', items: [{ id: 'dashboard', href: '/admin/home', label: 'Today', icon: Home }] },
  { label: 'Guests & Reservations', items: [
    { id: 'reservations', href: '/admin/reservation', label: 'Reservations', icon: CalendarDays },
    { id: 'guests', href: '/admin/guests', label: 'Guests', icon: Users },
    { id: 'follow-ups', href: '/admin/follow-ups', label: 'Visit follow-ups', icon: MessageSquare },
    { id: 'no-shows', href: '/admin/no-shows', label: 'No-show history', icon: Flag },
  ] },
  { label: 'Restaurant Operations', items: [
    { id: 'team', href: '/admin/team', label: 'Team View', icon: Users },
    { id: 'inventory', href: '/admin/inventory', label: 'Inventory', icon: Package },
    { id: 'hours', href: '/admin/hours', label: 'Hours', icon: Clock },
    { id: 'special-dates', href: '/admin/special-dates', label: 'Business Holidays', icon: Calendar },
    { id: 'cater', href: '/admin/cater', label: 'Catering', icon: Utensils },
    { id: 'labeling', href: '/admin/labeling', label: 'Food Labels', icon: Printer },
    { id: 'menu', href: '/admin/menu', label: 'Restaurant Menu', icon: BookText },
  ] },
  { label: 'Guest Engagement', items: [
    { id: 'mailing', href: '/admin/mailing', label: 'Mailing list', icon: Mail },
    { id: 'messages', href: '/admin/messages', label: 'Messages', icon: MessageSquare },
    { id: 'insights', href: '/admin/insights', label: 'Insights', icon: TrendingUp },
    { id: 'banner', href: '/admin/banner', label: 'Banner', icon: Flag },
  ] },
  { label: 'Settings', items: [{ id: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings }] },
];

export default function AdminSidebar() {
  const { restaurant } = useTimezone();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [emailCount, setEmailCount] = useState<number | null>(null);
  const [hiddenLinks, setHiddenLinks] = useState<string[]>(DEFAULT_HIDDEN);

  useEffect(() => {
    const stored = localStorage.getItem('admin-hidden-links');
    if (stored !== null) {
      try { setHiddenLinks(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    let active = true;
    const update = (event: Event) => { const value = (event as CustomEvent<number>).detail; mailingBadge = { value, fetchedAt: Date.now() }; setEmailCount(value); };
    const load = async () => {
      if (mailingBadge && Date.now() - mailingBadge.fetchedAt < 300_000) { setEmailCount(mailingBadge.value); return; }
      try { const response = await fetch('/api/staff/mailing?summary=1', { cache: 'no-store' }); if (!response.ok) return; const data = await response.json();
        if (active) { mailingBadge = { value: data.counts.total, fetchedAt: Date.now() }; setEmailCount(data.counts.total); }
      } catch { /* Do not present a failed count as zero. */ }
    };
    void load(); window.addEventListener('tablego-mailing-updated', update); window.addEventListener('focus', load);
    return () => { active = false; window.removeEventListener('tablego-mailing-updated', update); window.removeEventListener('focus', load); };
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
                  const badge = id === 'mailing' && emailCount !== null ? emailCount : id === 'messages' && unreadCount > 0 ? unreadCount : undefined;

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
                        <SidebarMenuBadge title={id === 'mailing' ? `${badge} unique email contacts` : undefined}>{badge}</SidebarMenuBadge>
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
            <span className="text-sm font-semibold text-sidebar-foreground truncate">{restaurant.name}</span>
            <span className="text-xs text-sidebar-foreground/50 truncate">Admin Panel</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
