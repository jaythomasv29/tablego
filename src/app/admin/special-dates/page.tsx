'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import AdminLayout from '@/components/AdminLayout';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface SpecialDate {
    id: string;
    date: string;
    reason: string;
}

export default function SpecialDatesAdmin() {
    const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
    const [newDate, setNewDate] = useState<Date | null>(null);
    const [reason, setReason] = useState('');
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
            setSpecialDates(dates);
        } catch (error) {
            console.error('Error loading special dates:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddDate = async () => {
        if (!newDate || !reason) return;

        try {
            await addDoc(collection(db, 'specialDates'), {
                date: newDate.toISOString(),
                reason
            });
            setNewDate(null);
            setReason('');
            loadSpecialDates();
        } catch (error) {
            console.error('Error adding special date:', error);
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
                        <h2 className="text-lg font-semibold mb-4">Add New Special Date</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Select Date"
                                    value={newDate}
                                    onChange={(date) => setNewDate(date)}
                                    disablePast
                                />
                            </LocalizationProvider>
                            <input
                                type="text"
                                placeholder="Reason (e.g., Christmas)"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                className="border rounded-md p-2"
                            />
                        </div>
                        <button
                            onClick={handleAddDate}
                            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                        >
                            Add Special Date
                        </button>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold mb-4">Special Dates</h2>
                        <div className="space-y-4">
                            {specialDates.map((date) => (
                                <div
                                    key={date.id}
                                    className="flex items-center justify-between border-b pb-2"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {new Date(date.date).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-gray-600">{date.reason}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteDate(date.id)}
                                        className="text-red-600 hover:text-red-800"
                                    >
                                        Delete
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AdminLayout>
    );
} 