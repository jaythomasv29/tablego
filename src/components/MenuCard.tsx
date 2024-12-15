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
        <>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
                <Navbar />
                <main className="w-[90vw] mx-auto px-4 py-8">
                    <div className="bg-white rounded-4xl shadow-xl p-6 md:p-8 h-[600px] overflow-y-auto">
                        <h1 className="text-4xl font-bold text-gray-800 mb-6 top-0 left-0 bg-white/95 py-4 backdrop-blur-sm z-10 border-b border-gray-200">
                            Our Menu
                        </h1>
                        {loading ? (
                            <div className="flex justify-center items-center h-full">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {groupByCategory(menuItems).map(({ category, items }) => (
                                    <div key={category} className="space-y-2">
                                        <h2 className="text-2xl font-bold text-gray-800 sticky left-0">
                                            {category}
                                        </h2>
                                        <div className="flex space-x-4 overflow-x-auto pb-4">
                                            {items.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex-shrink-0 w-[220px] border rounded-lg hover:shadow-md transition-shadow bg-white"
                                                >
                                                    <div className="h-20 w-full">
                                                        <img
                                                            src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Plate+of+Food"}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover rounded-t-lg"
                                                        />
                                                    </div>
                                                    <div className="p-3">
                                                        <div className="flex justify-between items-start">
                                                            <h3 className="text-md font-semibold">
                                                                {item.name}
                                                            </h3>
                                                            <span className="text-green-600 font-bold">
                                                                ${item.price?.toFixed(2) || '0.00'}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">
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
                    </div>
                </main>
            </div>
        </>
    );
}