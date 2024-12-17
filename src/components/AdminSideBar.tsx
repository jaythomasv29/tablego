'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function AdminSidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const isActiveLink = (path: string) => {
        return pathname === path ? "bg-gray-700" : "";
    };

    return (
        <>
            {/* Hamburger Menu Button (Mobile) */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-4 left-4 z-20 p-2 rounded-md bg-gray-800 text-white hover:bg-gray-700"
                aria-label="Toggle menu"
            >
                <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {isOpen ? (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    ) : (
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                        />
                    )}
                </svg>
            </button>

            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Sidebar - reduced width from w-64 to w-48 */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-20
                transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}
                lg:translate-x-0 transition-transform duration-200 ease-in-out
                w-48 bg-gray-800 text-white p-4 min-h-screen
            `}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-bold">Admin</h2>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 rounded-md hover:bg-gray-700"
                        aria-label="Close menu"
                    >
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <nav>
                    <ul className="space-y-1">
                        <li>
                            <Link
                                href="/admin/home"
                                className={`block py-2 px-3 rounded text-sm hover:bg-gray-700 transition-colors ${isActiveLink('/admin/home')}`}
                                onClick={() => setIsOpen(false)}
                            >
                                Home
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/hours"
                                className={`block py-2 px-3 rounded text-sm hover:bg-gray-700 transition-colors ${isActiveLink('/admin/hours')}`}
                                onClick={() => setIsOpen(false)}
                            >
                                Business Hours
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/reservation"
                                className={`block py-2 px-3 rounded text-sm hover:bg-gray-700 transition-colors ${isActiveLink('/admin/reservation')}`}
                                onClick={() => setIsOpen(false)}
                            >
                                Reservations
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/cater"
                                className={`block py-2 px-3 rounded text-sm hover:bg-gray-700 transition-colors ${isActiveLink('/admin/reservation')}`}
                                onClick={() => setIsOpen(false)}
                            >
                                Catering
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/menu"
                                className={`block py-2 px-3 rounded text-sm hover:bg-gray-700 transition-colors ${isActiveLink('/admin/menu')}`}
                                onClick={() => setIsOpen(false)}
                            >
                                Menu
                            </Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </>
    );
}