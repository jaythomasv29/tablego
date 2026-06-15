'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import PageTransition from '@/components/PageTransition';
import { collection, getDocs, query, where, orderBy, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { HelpCircle, Activity, Check, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTimezone } from '@/contexts/TimezoneContext';
import { formatReadableDatePST } from '@/utils/dateUtils';

interface NeedsReviewRecord {
    id: string;
    name: string;
    email: string;
    date: string;
    time: string;
    guests: number;
    followUpSentAt?: Timestamp;
}

interface CronLogRecord {
    id: string;
    runAt: Timestamp;
    sent: number;
    skipped: number;
    failed: number;
    total: number;
    note?: string;
}

export default function FollowUpsPage() {
    const { timezone } = useTimezone();
    const [tab, setTab] = useState<'review' | 'activity'>('review');
    const [needsReview, setNeedsReview] = useState<NeedsReviewRecord[]>([]);
    const [logs, setLogs] = useState<CronLogRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNeedsReview = async () => {
        const q = query(collection(db, 'reservations'), where('followUpSent', '==', true));
        const snapshot = await getDocs(q);
        const records = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((r: any) => !r.feedbackSentiment && (!r.attendanceStatus || r.attendanceStatus === 'default'))
            .map((r: any) => ({
                id: r.id,
                name: r.name || 'Unknown',
                email: r.email || '',
                date: r.date || '',
                time: r.time || '',
                guests: r.guests || 0,
                followUpSentAt: r.followUpSentAt,
            }))
            .sort((a, b) => b.date.localeCompare(a.date));

        setNeedsReview(records);
    };

    const fetchLogs = async () => {
        const q = query(collection(db, 'cronLogs'), orderBy('runAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        setLogs(
            snapshot.docs
                .map((d) => ({ id: d.id, ...d.data() } as CronLogRecord & { type?: string }))
                .filter((log) => log.type === 'follow-up')
        );
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                await Promise.all([fetchNeedsReview(), fetchLogs()]);
            } catch (error) {
                console.error('Error loading follow-ups:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleAttendanceUpdate = async (reservationId: string, status: 'show' | 'no-show') => {
        try {
            await updateDoc(doc(db, 'reservations', reservationId), { attendanceStatus: status });
            setNeedsReview((prev) => prev.filter((r) => r.id !== reservationId));
            toast.success(status === 'show' ? 'Marked as showed' : 'Marked as no-show');
        } catch (error) {
            console.error('Error updating attendance:', error);
            toast.error('Failed to update');
        }
    };

    return (
        <AdminLayout>
            <PageTransition>
                <Toaster
                    position="top-center"
                    toastOptions={{ duration: 3000, style: { background: '#363636', color: '#fff', zIndex: 9999 } }}
                />

                <div className="mb-6">
                    <h1 className="text-2xl font-bold">Follow-Ups</h1>
                    <p className="text-gray-600 mt-1">
                        Reservations awaiting a post-visit response, and recent follow-up cron activity.
                    </p>
                </div>

                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setTab('review')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            tab === 'review' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <HelpCircle className="w-4 h-4" />
                        Needs Review {needsReview.length > 0 && `(${needsReview.length})`}
                    </button>
                    <button
                        onClick={() => setTab('activity')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            tab === 'activity' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Activity className="w-4 h-4" />
                        Activity Log
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                    </div>
                ) : tab === 'review' ? (
                    needsReview.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                            <HelpCircle className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                            Nothing to review — every follow-up has been resolved.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-md overflow-hidden divide-y">
                            {needsReview.map((record) => (
                                <div key={record.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-900">{record.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {record.date ? formatReadableDatePST(record.date, timezone) : 'Unknown date'} · {record.time || '—'} · {record.guests} {record.guests === 1 ? 'guest' : 'guests'}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">Follow-up sent, no response yet</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => handleAttendanceUpdate(record.id, 'show')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                                        >
                                            <Check className="w-4 h-4" />
                                            Showed
                                        </button>
                                        <button
                                            onClick={() => handleAttendanceUpdate(record.id, 'no-show')}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                            No-Show
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : logs.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                        <Activity className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                        No follow-up runs recorded yet.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-md overflow-hidden divide-y">
                        {logs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {log.runAt?.toDate ? log.runAt.toDate().toLocaleString('en-US', { timeZone: timezone }) : 'Unknown time'}
                                    </p>
                                    {log.note && <p className="text-xs text-gray-400 mt-1">{log.note}</p>}
                                </div>
                                <div className="flex items-center gap-3 text-sm">
                                    <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700">{log.sent} sent</span>
                                    <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-600">{log.skipped} skipped</span>
                                    {log.failed > 0 && (
                                        <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700">{log.failed} failed</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </PageTransition>
        </AdminLayout>
    );
}
