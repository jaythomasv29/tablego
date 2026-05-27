"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Users,
  Printer,
  Package,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/firebase";

const HIDEABLE = ["inventory", "team", "messages"];
const DEFAULT_HIDDEN = ["inventory", "team", "messages"];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hiddenLinks, setHiddenLinks] = useState<string[]>(DEFAULT_HIDDEN);

  useEffect(() => {
    const stored = localStorage.getItem("admin-hidden-links");
    if (stored !== null) {
      try {
        setHiddenLinks(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const toggleLink = (id: string) => {
    setHiddenLinks((prev) => {
      const next = prev.includes(id)
        ? prev.filter((l) => l !== id)
        : [...prev, id];
      localStorage.setItem("admin-hidden-links", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const q = query(
          collection(db, "messages"),
          where("status", "==", "unread"),
        );
        const snapshot = await getDocs(q);
        setUnreadCount(snapshot.size);
      } catch (error) {
        console.error("Error fetching unread messages:", error);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const links = [
    { id: "dashboard", href: "/admin/home", label: "Dashboard", icon: Home },
    {
      id: "reservations",
      href: "/admin/reservation",
      label: "Reservations",
      icon: CalendarDays,
    },
    { id: "team", href: "/admin/team", label: "Team View", icon: Users },
    {
      id: "inventory",
      href: "/admin/inventory",
      label: "Inventory",
      icon: Package,
    },
    { id: "hours", href: "/admin/hours", label: "Hours", icon: Clock },
    {
      id: "special-dates",
      href: "/admin/special-dates",
      label: "Business Holidays",
      icon: Calendar,
    },
    { id: "cater", href: "/admin/cater", label: "Catering", icon: Utensils },
    {
      id: "labeling",
      href: "/admin/labeling",
      label: "Food Labels",
      icon: Printer,
    },
    {
      id: "menu",
      href: "/admin/menu",
      label: "Restaurant Menu",
      icon: BookText,
    },
    {
      id: "messages",
      href: "/admin/messages",
      label: "Messages",
      icon: MessageSquare,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { id: "banner", href: "/admin/banner", label: "Banner", icon: Flag },
    {
      id: "settings",
      href: "/admin/settings",
      label: "Settings",
      icon: Settings,
    },
  ];

  const NavLinks = () => (
    <ul className="space-y-1">
      {links.map(({ id, href, label, icon: Icon, badge }) => {
        const isActive = pathname === href;
        const isHideable = HIDEABLE.includes(id);
        const isHidden = hiddenLinks.includes(id);

        return (
          <li key={href} className="flex items-center gap-1">
            {isHidden ? (
              <span className="flex items-center space-x-2 px-4 py-2 rounded-lg flex-1 opacity-35 cursor-not-allowed text-sidebar-foreground select-none">
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate text-sm">{label}</span>
              </span>
            ) : (
              <Link
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors flex-1 text-sm ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{label}</span>
                {badge !== undefined && (
                  <span
                    className={`ml-auto px-2 py-0.5 text-xs rounded-full ${
                      isActive
                        ? "bg-primary-foreground text-primary"
                        : "bg-destructive text-white"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            )}
            {isHideable && (
              <button
                onClick={() => toggleLink(id)}
                className="p-1.5 rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
                title={isHidden ? `Show ${label}` : `Hide ${label}`}
              >
                {isHidden ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-card shadow-md hover:bg-accent"
        >
          {isMobileMenuOpen ? (
            <X className="w-6 h-6 text-muted-foreground" />
          ) : (
            <Menu className="w-6 h-6 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-sidebar shadow-xl animate-slide-right">
            <div className="p-4">
              <h1 className="text-xl font-bold text-sidebar-foreground">
                Admin Panel
              </h1>
            </div>
            <nav className="p-4">
              <NavLinks />
            </nav>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-64 bg-sidebar border-r border-sidebar-border h-screen sticky top-0 flex-col overflow-y-auto">
        <div className="p-4">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            Admin Panel
          </h1>
        </div>
        <nav className="flex-1 p-4">
          <NavLinks />
        </nav>
      </div>
    </>
  );
}
