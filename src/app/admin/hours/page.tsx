'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';

interface TimeRange { start: string; end: string; }

interface BusinessHours {
    [key: string]: {
        lunch: { open: string; close: string; isOpen: boolean; customRanges?: TimeRange[]; };
        dinner: { open: string; close: string; isOpen: boolean; customRanges?: TimeRange[]; };
    };
}

interface SpecialDate {
    id: string;
    date: string;
    reason: string;
    closureType?: 'full' | 'lunch' | 'dinner';
}

const defaultHours: BusinessHours = {
    monday:    { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '22:00', isOpen: true } },
    tuesday:   { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '22:00', isOpen: true } },
    wednesday: { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '22:00', isOpen: true } },
    thursday:  { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '22:00', isOpen: true } },
    friday:    { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '23:00', isOpen: true } },
    saturday:  { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '23:00', isOpen: true } },
    sunday:    { lunch: { open: '11:00', close: '15:00', isOpen: true }, dinner: { open: '17:00', close: '22:00', isOpen: true } },
};

export default function BusinessHoursAdmin() {
    const [hours, setHours] = useState<BusinessHours>(defaultHours);
    const [specialDates, setSpecialDates] = useState<SpecialDate[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const [showCustomRanges, setShowCustomRanges] = useState<{ day: string; mealType: 'lunch' | 'dinner' } | null>(null);

    useEffect(() => {
        Promise.all([loadBusinessHours(), loadSpecialDates()]).finally(() => setIsLoading(false));
    }, []);

    const loadSpecialDates = async () => {
        try {
            const snapshot = await getDocs(collection(db, 'specialDates'));
            setSpecialDates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SpecialDate[]);
        } catch (error) {
            console.error('Error loading special dates:', error);
        }
    };

    const loadBusinessHours = async () => {
        try {
            const hoursDoc = await getDoc(doc(db, 'settings', 'businessHours'));
            if (hoursDoc.exists()) {
                const data = hoursDoc.data() as BusinessHours;
                const merged = Object.keys(defaultHours).reduce((acc, day) => ({
                    ...acc,
                    [day]: {
                        lunch:  { ...defaultHours[day].lunch,  ...(data[day]?.lunch  || {}) },
                        dinner: { ...defaultHours[day].dinner, ...(data[day]?.dinner || {}) },
                    },
                }), {} as BusinessHours);
                setHours(merged);
            }
        } catch (error) {
            console.error('Error loading business hours:', error);
            alert('Failed to load business hours');
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'businessHours'), hours);
            alert('Business hours saved successfully');
            router.push('/admin/home');
        } catch (error) {
            console.error('Error saving business hours:', error);
            alert('Failed to save business hours');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChange = (day: string, mealType: 'lunch' | 'dinner', field: 'open' | 'close' | 'isOpen', value: string | boolean) => {
        setHours(prev => ({ ...prev, [day]: { ...prev[day], [mealType]: { ...prev[day][mealType], [field]: value } } }));
    };

    const handleAddCustomRange = (day: string, mealType: 'lunch' | 'dinner') => {
        setHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [mealType]: { ...prev[day][mealType], customRanges: [...(prev[day][mealType].customRanges || []), { start: '', end: '' }] } },
        }));
    };

    const handleUpdateCustomRange = (day: string, mealType: 'lunch' | 'dinner', index: number, field: 'start' | 'end', value: string) => {
        setHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [mealType]: { ...prev[day][mealType], customRanges: prev[day][mealType].customRanges?.map((r, i) => i === index ? { ...r, [field]: value } : r) } },
        }));
    };

    const handleRemoveCustomRange = (day: string, mealType: 'lunch' | 'dinner', index: number) => {
        setHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [mealType]: { ...prev[day][mealType], customRanges: prev[day][mealType].customRanges?.filter((_, i) => i !== index) } },
        }));
    };

    if (isLoading) return (
        <AdminLayout>
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
        </AdminLayout>
    );

    const inputClass = "mt-1 block w-full rounded-md border border-border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring px-3 py-2 text-sm";

    return (
        <AdminLayout>
            <div className="max-w-4xl mx-auto p-6">
                <Link href="/admin/home" className="inline-flex items-center mb-4 text-muted-foreground hover:text-foreground transition-colors text-sm">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Dashboard
                </Link>

                <h1 className="text-2xl font-bold text-foreground mb-6">Business Hours Management</h1>

                {specialDates.length > 0 && (
                    <div className="bg-card border border-border shadow-sm rounded-lg p-6 mb-6">
                        <h2 className="text-base font-semibold text-foreground mb-4">Holiday Closures</h2>
                        <div className="flex flex-wrap gap-2">
                            {specialDates.map((sd) => {
                                const date = new Date(sd.date);
                                return (
                                    <div key={sd.id} className="inline-flex items-center bg-muted px-3 py-1 rounded-full border border-border text-sm">
                                        <span className="font-medium text-foreground">
                                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <span className="mx-1 text-muted-foreground">•</span>
                                        <span className="text-muted-foreground">
                                            {sd.reason}
                                            {sd.closureType && (
                                                <span className="ml-1 text-xs text-primary">
                                                    ({sd.closureType === 'full' ? 'full day' : `${sd.closureType} closed`})
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="mt-4">
                            <Link href="/admin/special-dates" className="text-sm text-primary hover:text-primary/80 transition-colors">
                                Manage Holiday Closures →
                            </Link>
                        </div>
                    </div>
                )}

                <div className="bg-card border border-border shadow-sm rounded-lg p-6">
                    {Object.entries(hours).map(([day, mealTimes]) => (
                        <div key={day} className="mb-6 p-4 border border-border rounded-lg">
                            <h2 className="text-base font-semibold text-foreground capitalize mb-4">{day}</h2>

                            {(['lunch', 'dinner'] as const).map((mealType) => (
                                <div key={mealType} className={mealType === 'dinner' ? '' : 'mb-6'}>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-medium text-foreground capitalize">{mealType} Hours</h3>
                                        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={mealTimes[mealType].isOpen}
                                                onChange={(e) => handleChange(day, mealType, 'isOpen', e.target.checked)}
                                                className="rounded border-border"
                                            />
                                            Open for {mealType}
                                        </label>
                                    </div>

                                    {mealTimes[mealType].isOpen && (
                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Opening Time</label>
                                                <input type="time" value={mealTimes[mealType].open} onChange={(e) => handleChange(day, mealType, 'open', e.target.value)} className={inputClass} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-muted-foreground mb-1">Closing Time</label>
                                                <input type="time" value={mealTimes[mealType].close} onChange={(e) => handleChange(day, mealType, 'close', e.target.value)} className={inputClass} />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setShowCustomRanges(prev => prev?.day === day && prev?.mealType === mealType ? null : { day, mealType })}
                                            className="text-xs text-primary hover:text-primary/80 transition-colors"
                                        >
                                            Manage Custom Time Ranges
                                        </button>
                                        {showCustomRanges?.day === day && showCustomRanges?.mealType === mealType && (
                                            <div className="mt-2 p-4 bg-muted/50 rounded-lg border border-border">
                                                <h4 className="text-xs font-medium text-foreground mb-3">Custom Time Ranges</h4>
                                                {hours[day][mealType].customRanges?.map((range, index) => (
                                                    <div key={index} className="flex items-center gap-2 mb-2">
                                                        <input type="time" value={range.start} onChange={(e) => handleUpdateCustomRange(day, mealType, index, 'start', e.target.value)} className="w-32 px-2 py-1 border border-border rounded bg-background text-foreground text-sm" />
                                                        <span className="text-muted-foreground text-sm">to</span>
                                                        <input type="time" value={range.end} onChange={(e) => handleUpdateCustomRange(day, mealType, index, 'end', e.target.value)} className="w-32 px-2 py-1 border border-border rounded bg-background text-foreground text-sm" />
                                                        <button type="button" onClick={() => handleRemoveCustomRange(day, mealType, index)} className="text-xs text-destructive hover:text-destructive/80 transition-colors">Remove</button>
                                                    </div>
                                                ))}
                                                <button type="button" onClick={() => handleAddCustomRange(day, mealType)} className="mt-1 text-xs bg-card px-3 py-1 border border-border rounded hover:bg-muted transition-colors text-foreground">
                                                    Add Range
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}

                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="w-full mt-4 bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors font-medium"
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
