// src/app/admin/menu/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import AdminLayout from '@/components/AdminLayout';
import Link from 'next/link';
import { seedMenu } from '@/utils/seedMenu';

interface MenuItem {
    id?: string;
    name: string;
    price?: number;
    description: string;
    category: string;
    imageUrl: string;
    // add other required properties
}

const groupByCategory = (items: MenuItem[]) => {
    return items.reduce((acc, item) => {
        if (!acc[item.category]) {
            acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
    }, {} as { [key: string]: MenuItem[] });
};

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

const sortByCategory = (items: MenuItem[]) => {
    const grouped = groupByCategory(items);
    return CATEGORY_ORDER.map(category => ({
        category,
        items: grouped[category] || []
    })).filter(group => group.items.length > 0);
};

const EditModal = ({ item, isOpen, onClose, onSave }: {
    item: MenuItem;
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: MenuItem) => void;
}) => {
    const [editedItem, setEditedItem] = useState(item);

    if (!isOpen) return null;

    const handleSave = () => {
        // Ensure price is a number and all required fields are present
        const updatedItem = {
            ...editedItem,
            id: item.id, // Make sure we pass the id
            price: parseFloat(editedItem?.price?.toString() || '0'),
            name: editedItem.name.trim(),
            description: editedItem.description.trim(),
            category: editedItem.category.trim(),
            imageUrl: editedItem.imageUrl?.trim() || ''
        };

        onSave(updatedItem);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg w-full max-w-2xl">
                <h2 className="text-xl font-bold mb-4">Edit Menu Item</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Name</label>
                        <input
                            type="text"
                            value={editedItem.name}
                            onChange={(e) => setEditedItem({ ...editedItem, name: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Description</label>
                        <textarea
                            value={editedItem.description}
                            onChange={(e) => setEditedItem({ ...editedItem, description: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Price</label>
                        <input
                            type="number"
                            step="0.01"
                            value={editedItem.price}
                            onChange={(e) => setEditedItem({ ...editedItem, price: parseFloat(e.target.value) })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Category</label>
                        <input
                            type="text"
                            value={editedItem.category}
                            onChange={(e) => setEditedItem({ ...editedItem, category: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Image URL</label>
                        <input
                            type="url"
                            value={editedItem.imageUrl}
                            onChange={(e) => setEditedItem({ ...editedItem, imageUrl: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="bg-gray-500 text-white px-4 py-2 rounded"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-blue-500 text-white px-4 py-2 rounded"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default function MenuManagement() {
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItem, setNewItem] = useState({
        name: '',
        description: '',
        price: '',
        category: '',
        imageUrl: ''
    });
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
    const [viewMode, setViewMode] = useState<'store' | 'multi'>('store');

    useEffect(() => {
        fetchMenuItems();
    }, []);

    const fetchMenuItems = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'menu'));
            const items = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...(doc.data() as Omit<MenuItem, 'id'>)
            }));
            setMenuItems(items);
        } catch (error) {
            console.error('Error fetching menu items:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const docRef = await addDoc(collection(db, 'menu'), {
                name: newItem.name,
                description: newItem.description,
                price: parseFloat(newItem.price),
                category: newItem.category
            });
            setNewItem({ name: '', description: '', price: '', category: '', imageUrl: '' });
            fetchMenuItems();
        } catch (error) {
            console.error('Error adding menu item:', error);
        }
    };

    const handleDeleteItem = async (id: string) => {
        if (typeof window !== 'undefined' && window.confirm('Are you sure you want to delete this item?')) {
            try {
                await deleteDoc(doc(db, 'menu', id));
                fetchMenuItems();
            } catch (error) {
                console.error('Error deleting menu item:', error);
            }
        }
    };

    const handleEditItem = async (editedItem: MenuItem) => {
        try {
            if (editedItem.id) {
                await updateDoc(doc(db, 'menu', editedItem.id), {
                    name: editedItem.name,
                    description: editedItem.description,
                    price: editedItem.price,
                    category: editedItem.category,
                    imageUrl: editedItem.imageUrl || ''
                });
            }

            // Update local state instead of fetching
            setMenuItems(prevItems =>
                prevItems.map(item =>
                    item.id === editedItem.id ? editedItem : item
                )
            );

            setModalOpen(false);
        } catch (error) {
            console.error('Error updating menu item:', error);
        }
    };

    const startEditing = (item: MenuItem) => {

        setSelectedItem(item);
        setModalOpen(true);

    };

    const handleSeedMenu = async () => {
        if (typeof window !== 'undefined' && window.confirm('Are you sure you want to seed the menu? This might create duplicate items.')) {
            await seedMenu();
            fetchMenuItems();
        }
    };

    return (
        <AdminLayout>
            <div className="p-6">
                <Link
                    href="/admin/home"
                    className="inline-flex items-center mb-4 text-gray-600 hover:text-gray-800"
                >
                    <svg
                        className="w-6 h-6 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                        />
                    </svg>
                    Back to Dashboard
                </Link>

                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Menu Management</h1>
                    <div className="space-x-4">
                        <button
                            onClick={() => setViewMode('store')}
                            className={`px-4 py-2 rounded ${viewMode === 'store'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Store View
                        </button>
                        <button
                            onClick={() => setViewMode('multi')}
                            className={`px-4 py-2 rounded ${viewMode === 'multi'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Multi Edit View
                        </button>
                    </div>
                </div>

                {viewMode === 'store' ? (
                    <>
                        {/* Quick Navigation Links */}
                        <div className="mb-8 bg-white p-4 rounded-lg shadow sticky top-0 z-10">
                            <h3 className="text-lg font-semibold mb-2">Quick Navigation</h3>
                            <div className="flex flex-wrap gap-2">
                                {CATEGORY_ORDER.map(category => (
                                    <a
                                        key={category}
                                        href={`#${category.toLowerCase().replace(/\s+/g, '-')}`}
                                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                                    >
                                        {category}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Add/Edit Form */}
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (isEditing) {
                                handleEditItem({ ...newItem, price: Number(newItem.price) } as MenuItem);
                            } else {
                                handleAddItem(e);
                            }
                        }} className="mb-8 bg-white p-6 rounded-lg shadow">
                            <h2 className="text-xl font-semibold mb-4">{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Name</label>
                                    <input
                                        type="text"
                                        value={newItem.name}
                                        onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Category</label>
                                    <input
                                        type="text"
                                        value={newItem.category}
                                        onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Price</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={newItem.price}
                                        onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Description</label>
                                    <textarea
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Image URL (optional)</label>
                                    <input
                                        type="url"
                                        value={newItem.imageUrl || ''}
                                        onChange={(e) => setNewItem({ ...newItem, imageUrl: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        placeholder="https://example.com/image.jpg"
                                    />
                                </div>
                            </div>
                            <div className="mt-4">
                                <button
                                    type="submit"
                                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                                >
                                    {isEditing ? 'Update Item' : 'Add Item'}
                                </button>
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditingId('');
                                            setNewItem({ name: '', description: '', price: '', category: '', imageUrl: '' });
                                        }}
                                        className="ml-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                        {/* <button onClick={handleSeedMenu} className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                            Seed Menu
                        </button> */}
                        {/* Menu Items Display */}
                        {loading ? (
                            <div className="flex justify-center items-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                {sortByCategory(menuItems).map(({ category, items }) => (
                                    <div
                                        key={category}
                                        id={category.toLowerCase().replace(/\s+/g, '-')}
                                        className="scroll-mt-24" // Add padding for sticky header
                                    >
                                        <div className="flex items-center mb-6">
                                            <h2 className="text-2xl font-bold text-gray-800">{category}</h2>
                                            <div className="ml-4 flex-grow border-b border-gray-300"></div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {items.map((item) => (
                                                <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                                                    <div className="h-48 bg-gray-200">
                                                        <img
                                                            src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Plate+of+Food"}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="p-4">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <h3 className="text-lg font-semibold">{item.name}</h3>
                                                            <span className="text-green-600 font-bold">
                                                                ${item.price?.toFixed(2) || '0.00'}
                                                            </span>
                                                        </div>
                                                        <p className="text-gray-600 text-sm mb-4">
                                                            {item.description}
                                                        </p>
                                                        <div className="flex justify-end space-x-2">
                                                            <button
                                                                onClick={() => startEditing(item)}
                                                                className="text-indigo-600 hover:text-indigo-900 text-sm"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteItem(item?.id || '')}
                                                                className="text-red-600 hover:text-red-900 text-sm"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {modalOpen && selectedItem && (
                            <EditModal
                                item={selectedItem}
                                isOpen={modalOpen}
                                onClose={() => setModalOpen(false)}
                                onSave={handleEditItem}
                            />
                        )}
                    </>
                ) : (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Multi Edit View</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image URL</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {sortByCategory(menuItems).flatMap(({ category, items }) =>
                                        items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <img
                                                        src={item.imageUrl || "https://placehold.co/400x300/e2e8f0/666666?text=Plate+of+Food"}
                                                        alt={item.name}
                                                        className="w-20 h-20 object-cover rounded"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="text"
                                                        defaultValue={item.name}
                                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                        onBlur={(e) => handleEditItem({
                                                            ...item,
                                                            name: e.target.value
                                                        })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="text"
                                                        defaultValue={item.category}
                                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                        onBlur={(e) => handleEditItem({
                                                            ...item,
                                                            category: e.target.value
                                                        })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        defaultValue={item.price}
                                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                        onBlur={(e) => handleEditItem({
                                                            ...item,
                                                            price: parseFloat(e.target.value)
                                                        })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <textarea
                                                        defaultValue={item.description}
                                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                        onBlur={(e) => handleEditItem({
                                                            ...item,
                                                            description: e.target.value
                                                        })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="url"
                                                        defaultValue={item.imageUrl}
                                                        className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                                        onBlur={(e) => handleEditItem({
                                                            ...item,
                                                            imageUrl: e.target.value
                                                        })}
                                                    />
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button
                                                        onClick={() => handleDeleteItem(item.id || '')}
                                                        className="text-red-600 hover:text-red-900"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}