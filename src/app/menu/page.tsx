'use client';
import MenuCard from '@/components/MenuCard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import React, { useState } from 'react';

const CATEGORY_ORDER = [
    'Appetizers',
    'Salad',
    'Soup',
    'Signature Dishes',
    'Wok',
    'Curry',
    'Noodles',
    'Fried Rice',
    'Grill',
    'Sides'
];

const MenuPage = () => {
    const [activeCategory, setActiveCategory] = useState<string | null>(null);

    const scrollToCategory = (category: string) => {
        setActiveCategory(category);
    };

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

            <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-20">
                {CATEGORY_ORDER.map((category) => (
                    <button
                        key={category}
                        onClick={() => scrollToCategory(category)}
                        className="text-sm font-medium text-gray-600 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-lg 
                        shadow-sm hover:bg-white hover:shadow-md transition-all duration-200"
                    >
                        {category}
                    </button>
                ))}
            </div>

            <MenuCard activeCategory={activeCategory} />
        </div>
    );
};

export default MenuPage;
