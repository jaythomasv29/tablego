'use client';
import MenuCard from '@/components/MenuCard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import React from 'react';

const MenuPage = () => {
    return (
        <div className="relative">
            <Link
                href="/"
                className="fixed top-1/2 left-4 transform -translate-y-1/2 flex flex-col items-center gap-2 z-20"
                passHref
            >
                <div className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors cursor-pointer">
                    <ArrowLeft className="h-6 w-6 text-gray-600" />
                </div>
                <span className="text-sm font-medium text-gray-600 bg-white/80 backdrop-blur-sm px-2 py-1 rounded shadow-sm">
                    Reserve
                </span>
            </Link>
            <MenuCard />
        </div>
    );
};

export default MenuPage;
