'use client';

import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

interface MenuItem {
    id?: string;
    name: string;
    price?: number;
    description: string;
    category: string;
    imageUrl: string;
}

const CATEGORY_ORDER = [
    'Appetizers',
    'Salad',
    'Soup',
    'Salad',
    'Signature Dishes',
    'Wok',
    'Curry',
    'Noodles',
    'Fried Rice',
    'Grill',
    'Sides'
];

export default function MenuCard() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMenuItems = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'menu'));
                const items = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as MenuItem));
                setMenuItems(items);
            } catch (error) {
                console.error('Error fetching menu:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchMenuItems();
    }, []);

    const groupByCategory = (items: MenuItem[]) => {
        return CATEGORY_ORDER.map(category => ({
            category,
            items: items.filter(item => item.category === category)
        })).filter(group => group.items.length > 0);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-8 sticky top-0 bg-gradient-to-br from-gray-50 to-gray-100 py-4 z-10">
                    Our Menu
                </h1>
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {groupByCategory(menuItems).map(({ category, items }) => (
                            <div key={category} className="space-y-4">
                                <h2 className="text-2xl font-bold text-gray-800 sticky top-20 bg-gradient-to-br from-gray-50 to-gray-100 py-2 z-10">
                                    {category}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {items.map((item) => (
                                        <div
                                            key={item.id}
                                            className="border rounded-lg hover:shadow-md transition-shadow bg-white overflow-hidden"
                                        >
                                            <div className="h-48 w-full">
                                                <img
                                                    src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Plate+of+Food"}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h3 className="text-lg font-semibold">
                                                        {item.name}
                                                    </h3>
                                                    <span className="text-green-600 font-bold">
                                                        ${item.price?.toFixed(2) || '0.00'}
                                                    </span>
                                                </div>
                                                <p className="text-gray-600 text-sm line-clamp-2">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}