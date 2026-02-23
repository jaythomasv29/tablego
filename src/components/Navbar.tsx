import Link from 'next/link';
import { Utensils, ShoppingBag, Search, X, Menu as MenuIcon } from 'lucide-react';
import { useState } from 'react';
import ReservationModal from './ReservationModal';

export default function Navbar() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <div className="relative">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link
                            href="/"
                            className="flex items-center space-x-2 hover:opacity-90 transition-opacity"
                        >
                            <Utensils className="h-6 w-6 text-indigo-600" />
                            <div className="relative">
                                <span className="text-xl font-semibold text-gray-900">Thaiphoon</span>
                                {/* <span className="absolute -bottom-3 right-0 text-[10px] text-gray-400">
                                    by tablego
                                </span> */}
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center space-x-6">
                            <Link
                                href="/"
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <span className="text-sm font-medium">Reserve</span>
                            </Link>
                            <Link
                                href="/menu"
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <span className="text-sm font-medium">Menu</span>
                            </Link>
                            {/* <Link
                                href="/cater"
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <span className="text-sm font-medium">Cater</span>
                            </Link> */}
                            <Link
                                href="https://order.online/business/Thaiphoon-450?utm_source=sdk&visitorId=193be2bc7cf1d9e9c"
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <ShoppingBag className="h-5 w-5" />
                                <span className="text-sm font-medium">Order Online</span>
                            </Link>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <Search className="h-5 w-5" />
                                <span className="text-sm font-medium">Find Reservation</span>
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-gray-600 hover:text-indigo-600"
                        >
                            {isMobileMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <MenuIcon className="h-6 w-6" />
                            )}
                        </button>
                    </div>

                    {/* Mobile Navigation */}
                    {isMobileMenuOpen && (
                        <div className="md:hidden pt-4 pb-3 border-t border-gray-200">
                            <div className="flex flex-col space-y-4">
                                <Link
                                    href="/"
                                    className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors px-2"
                                >
                                    <span className="text-sm font-medium">Reserve</span>
                                </Link>
                                <Link
                                    href="/menu"
                                    className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors px-2"
                                >
                                    <span className="text-sm font-medium">Menu</span>
                                </Link>
                                <Link
                                    href="/cater"
                                    className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors px-2"
                                >
                                    <span className="text-sm font-medium">Cater</span>
                                </Link>
                                <Link
                                    href="https://order.online/business/Thaiphoon-450?utm_source=sdk&visitorId=193be2bc7cf1d9e9c"
                                    className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors px-2"
                                >
                                    <ShoppingBag className="h-5 w-5" />
                                    <span className="text-sm font-medium">Order Online</span>
                                </Link>
                                <button
                                    onClick={() => {
                                        setIsModalOpen(true);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors px-2"
                                >
                                    <Search className="h-5 w-5" />
                                    <span className="text-sm font-medium">Find Reservation</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </nav>

            {/* Modal */}
            {isModalOpen && (
                <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            )}
        </div>
    );
}
