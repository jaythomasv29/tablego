'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import AdminLayout from '@/components/AdminLayout';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

type ClosureType = 'full' | 'lunch' | 'dinner';

interface SpecialDate {
    id: string;
    date: string;
    reason: string;
    closureType?: ClosureType;
}

export default function SpecialDatesAdmin() {
    const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
    const [newDate, setNewDate] = useState<Date | null>(null);
    const [reason, setReason] = useState('');
    const [closureType, setClosureType] = useState<ClosureType>('full');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addError, setAddError] = useState('');
    const [editingDateId, setEditingDateId] = useState<string | null>(null);
    const [editDate, setEditDate] = useState<Date | null>(null);
    const [editReason, setEditReason] = useState('');
    const [editClosureType, setEditClosureType] = useState<ClosureType>('full');
    const [editError, setEditError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSpecialDates();
    }, []);

    const loadSpecialDates = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'specialDates'));
            const dates = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as SpecialDate[];
            dates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSpecialDates(dates);
        } catch (error) {
            console.error('Error loading special dates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDate = async () => {
        if (!newDate) return;
        if (!reason.trim()) {
            setAddError('Reason is required.');
            return;
        }
        setAddError('');

        try {
            const payload = {
                date: newDate.toISOString(),
                reason: reason.trim(),
                closureType
            };

            await addDoc(collection(db, 'specialDates'), payload);
            setNewDate(null);
            setReason('');
            setClosureType('full');
            setAddError('');
            setIsAddModalOpen(false);
            loadSpecialDates();
        } catch (error) {
            console.error('Error saving special date:', error);
        }
    };

    const handleDeleteDate = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'specialDates', id));
            loadSpecialDates();
        } catch (error) {
            console.error('Error deleting special date:', error);
        }
    };

    const startEdit = (item: SpecialDate) => {
        setEditingDateId(item.id);
        setEditDate(new Date(item.date));
        setEditReason(item.reason || '');
        setEditClosureType(item.closureType || 'full');
        setEditError('');
    };

    const cancelEditModal = () => {
        setEditingDateId(null);
        setEditDate(null);
        setEditReason('');
        setEditClosureType('full');
        setEditError('');
    };

    const handleSaveEdit = async () => {
        if (!editingDateId || !editDate) return;
        if (!editReason.trim()) {
            setEditError('Reason is required.');
            return;
        }
        setEditError('');

        try {
            await updateDoc(doc(db, 'specialDates', editingDateId), {
                date: editDate.toISOString(),
                reason: editReason.trim(),
                closureType: editClosureType
            });
            cancelEditModal();
            loadSpecialDates();
        } catch (error) {
            console.error('Error saving special date:', error);
        }
    };

    const getClosureLabel = (type?: ClosureType) => {
        const value = type || 'full';
        if (value === 'lunch') return 'Lunch Closed';
        if (value === 'dinner') return 'Dinner Closed';
        return 'Full Day Closed';
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto p-6">
                <h1 className="text-2xl font-bold mb-6">Special Dates Management</h1>

                <div className="bg-white shadow rounded-lg p-6">
                    <div className="mb-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Special Dates</h2>
                            <button
                                onClick={() => {
                                    setAddError('');
                                    setNewDate(null);
                                    setReason('');
                                    setClosureType('full');
                                    setIsAddModalOpen(true);
                                }}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                            >
                                Add Special Date
                            </button>
                        </div>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold mb-4">Existing Closures</h2>
                        <div className="space-y-4">
                            {specialDates.map((date) => {
                                const closureDate = new Date(date.date);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const closureDay = new Date(closureDate);
                                closureDay.setHours(0, 0, 0, 0);
                                const isPastClosure = closureDay < today;

                                return (
                                    <div
                                        key={date.id}
                                        className={`flex items-center justify-between border-b pb-2 ${
                                            isPastClosure ? 'opacity-65' : ''
                                        }`}
                                    >
                                        <div>
                                            <p className={`font-medium ${isPastClosure ? 'text-gray-500' : ''}`}>
                                                {closureDate.toLocaleDateString()}
                                            </p>
                                            <p className={`text-sm ${isPastClosure ? 'text-gray-500' : 'text-gray-600'}`}>
                                                {date.reason}
                                            </p>
                                            <p className={`text-xs mt-0.5 ${isPastClosure ? 'text-gray-500' : 'text-indigo-600'}`}>
                                                {getClosureLabel(date.closureType)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => startEdit(date)}
                                                className={`${isPastClosure ? 'text-gray-500 hover:text-gray-700' : 'text-blue-600 hover:text-blue-800'}`}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDate(date.id)}
                                                className={`${isPastClosure ? 'text-gray-500 hover:text-gray-700' : 'text-red-600 hover:text-red-800'}`}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {isAddModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={() => setIsAddModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">Add New Special Date</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Select Date"
                                    value={newDate}
                                    onChange={(date) => setNewDate(date)}
                                    disablePast
                                />
                            </LocalizationProvider>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Reason (e.g., Christmas)"
                                    value={reason}
                                    onChange={(e) => {
                                        setReason(e.target.value);
                                        if (addError) setAddError('');
                                    }}
                                    className={`border rounded-md p-2 w-full ${addError ? 'border-red-400' : ''}`}
                                />
                                {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Closure</label>
                                <select
                                    value={closureType}
                                    onChange={(e) => setClosureType(e.target.value as ClosureType)}
                                    className="border rounded-md p-2 w-full"
                                >
                                    <option value="full">Full Day Closed</option>
                                    <option value="lunch">Lunch Closed (Dinner Open)</option>
                                    <option value="dinner">Dinner Closed (Lunch Open)</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddDate}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                            >
                                Add Special Date
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingDateId && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={cancelEditModal}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-5 py-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">Edit Special Date</h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Select Date"
                                    value={editDate}
                                    onChange={(date) => setEditDate(date)}
                                    disablePast
                                />
                            </LocalizationProvider>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                    Reason <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Reason (e.g., Christmas)"
                                    value={editReason}
                                    onChange={(e) => {
                                        setEditReason(e.target.value);
                                        if (editError) setEditError('');
                                    }}
                                    className={`border rounded-md p-2 w-full ${editError ? 'border-red-400' : ''}`}
                                />
                                {editError && <p className="text-xs text-red-600 mt-1">{editError}</p>}
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">Closure</label>
                                <select
                                    value={editClosureType}
                                    onChange={(e) => setEditClosureType(e.target.value as ClosureType)}
                                    className="border rounded-md p-2 w-full"
                                >
                                    <option value="full">Full Day Closed</option>
                                    <option value="lunch">Lunch Closed (Dinner Open)</option>
                                    <option value="dinner">Dinner Closed (Lunch Open)</option>
                                </select>
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t flex items-center justify-end gap-2">
                            <button
                                onClick={cancelEditModal}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
} 