import Link from 'next/link';
import { Utensils, ShoppingBag, Search, X } from 'lucide-react';
import { useState } from 'react';
import ReservationModal from './ReservationModal';

export default function Navbar() {
    const [isModalOpen, setIsModalOpen] = useState(false);


    return (
        <div className="relative">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <Link
                            href="/"
                            className="flex items-center space-x-2 hover:opacity-90 transition-opacity"
                        >
                            <Utensils className="h-6 w-6 text-indigo-600" />
                            <div className="relative">
                                <span className="text-xl font-semibold text-gray-900">Thaiphoon Restaurant</span>
                                <span className="absolute -bottom-3 right-0 text-[10px] text-gray-400">
                                    by tablego
                                </span>
                            </div>
                        </Link>

                        <div className="flex items-center space-x-6">
                            <Link
                                href="https://order.online/business/Thaiphoon-450?utm_source=sdk&visitorId=193be2bc7cf1d9e9c"
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <ShoppingBag className="h-5 w-5" />
                                <span className="text-sm font-medium">Order Online</span>
                            </Link>

                            <button
                                onClick={() => {
                                    console.log('Button clicked'); // Debug log
                                    setIsModalOpen(true);
                                }}
                                className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 transition-colors"
                            >
                                <Search className="h-5 w-5" />
                                <span className="text-sm font-medium">Find My Reservation</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Modal */}
            {isModalOpen && (
                <ReservationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
            )}
        </div>
    );
}
