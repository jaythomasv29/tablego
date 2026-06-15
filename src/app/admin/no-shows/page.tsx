'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import PageTransition from '@/components/PageTransition';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';
import { UserX, ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { useTimezone } from '@/contexts/TimezoneContext';
import { formatReadableDatePST } from '@/utils/dateUtils';

interface NoShowRecord {
    id: string;
    name: string;
    phone: string;
    date: string;
    time: string;
    guests: number;
}

interface GroupedNoShow {
    phone: string;
    names: string[];
    count: number;
    records: NoShowRecord[];
    lastDate: string;
}

const normalizePhone = (phone: string): string => phone.replace(/\D/g, '');

export default function NoShowsPage() {
    const { timezone } = useTimezone();
    const [groups, setGroups] = useState<GroupedNoShow[]>([]);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchNoShows = async () => {
            try {
                const q = query(collection(db, 'reservations'), where('attendanceStatus', '==', 'no-show'));
                const snapshot = await getDocs(q);
                const records = snapshot.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        name: data.name || 'Unknown',
                        phone: data.phone || '',
                        date: data.date || '',
                        time: data.time || '',
                        guests: data.guests || 0,
                    } as NoShowRecord;
                });

                const byPhone = new Map<string, GroupedNoShow>();
                records.forEach((record) => {
                    const key = record.phone ? normalizePhone(record.phone) : `unknown-${record.id}`;
                    const existing = byPhone.get(key);
                    if (existing) {
                        existing.count += 1;
                        existing.records.push(record);
                        if (!existing.names.includes(record.name)) existing.names.push(record.name);
                        if (record.date > existing.lastDate) existing.lastDate = record.date;
                    } else {
                        byPhone.set(key, {
                            phone: record.phone || 'No phone on file',
                            names: [record.name],
                            count: 1,
                            records: [record],
                            lastDate: record.date,
                        });
                    }
                });

                const grouped = Array.from(byPhone.values())
                    .map((g) => ({
                        ...g,
                        records: g.records.sort((a, b) => b.date.localeCompare(a.date)),
                    }))
                    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate));

                setGroups(grouped);
            } catch (error) {
                console.error('Error loading no-shows:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNoShows();
    }, []);

    const toggleExpanded = (phone: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(phone)) next.delete(phone);
            else next.add(phone);
            return next;
        });
    };

    return (
        <AdminLayout>
            <PageTransition>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold">No-Shows</h1>
                    <p className="text-gray-600 mt-1">
                        Guests marked as no-show, grouped by phone number so repeat offenders are easy to spot.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                        <UserX className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        No no-shows recorded yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <div className="divide-y">
                            {groups.map((group) => {
                                const isExpanded = expanded.has(group.phone);
                                return (
                                    <div key={group.phone}>
                                        <button
                                            onClick={() => toggleExpanded(group.phone)}
                                            className="w-full flex items-center justify-between gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="p-2 bg-red-50 rounded-full shrink-0">
                                                    <Phone className="w-4 h-4 text-red-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-gray-900 truncate">{group.phone}</p>
                                                    <p className="text-sm text-gray-500 truncate">{group.names.join(', ')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                        group.count >= 3
                                                            ? 'bg-red-100 text-red-700'
                                                            : group.count === 2
                                                                ? 'bg-amber-100 text-amber-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                    }`}
                                                >
                                                    {group.count} no-show{group.count !== 1 ? 's' : ''}
                                                </span>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                                )}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="px-4 pb-4">
                                                <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200">
                                                    {group.records.map((record) => (
                                                        <div key={record.id} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                                                            <span className="font-medium text-gray-900">{record.name}</span>
                                                            <span className="text-gray-500">
                                                                {record.date ? formatReadableDatePST(record.date, timezone) : 'Unknown date'} · {record.time || '—'}
                                                            </span>
                                                            <span className="text-gray-500 shrink-0">
                                                                {record.guests} {record.guests === 1 ? 'guest' : 'guests'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </PageTransition>
        </AdminLayout>
    );
}
