'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import PageTransition from '@/components/PageTransition';
import { collection, getDocs, getDoc, query, where, orderBy, limit, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { HelpCircle, Activity, Check, X, Send, RefreshCw, Mail } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTimezone } from '@/contexts/TimezoneContext';
import { formatReadableDatePST, getTodayInTimezone, getReservationDateTime } from '@/utils/dateUtils';

interface PendingFollowUp {
    id: string;
    name: string;
    email: string;
    date: string;
    time: string;
    guests: number;
    ready: boolean;
}

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
    const [tab, setTab] = useState<'send' | 'review' | 'activity'>('send');
    const [pending, setPending] = useState<PendingFollowUp[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState<Set<string>>(new Set());
    const [sendingAll, setSendingAll] = useState(false);
    const [needsReview, setNeedsReview] = useState<NeedsReviewRecord[]>([]);
    const [logs, setLogs] = useState<CronLogRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPending = async () => {
        const generalDoc = await getDoc(doc(db, 'settings', 'general'));
        const delay = generalDoc.exists() ? generalDoc.data()?.followUpDelayMinutes ?? 90 : 90;

        // Last 7 days (today + previous 6 days)
        const dates = Array.from({ length: 7 }, (_, i) => getTodayInTimezone(timezone, -i));

        const q = query(collection(db, 'reservations'), where('date', 'in', dates));
        const snapshot = await getDocs(q);

        const now = new Date();
        const records: PendingFollowUp[] = snapshot.docs
            .map((d) => ({ id: d.id, ...d.data() } as any))
            .filter((r) => r.status !== 'cancelled' && !r.followUpSent && r.email)
            .map((r) => {
                const reservationTime = getReservationDateTime(r.date, r.time, timezone);
                const dueAt = new Date(reservationTime.getTime() + delay * 60 * 1000);
                return {
                    id: r.id,
                    name: r.name || 'Unknown',
                    email: r.email || '',
                    date: r.date || '',
                    time: r.time || '',
                    guests: r.guests || 0,
                    ready: now >= dueAt,
                };
            })
            .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : b.date.localeCompare(a.date)));

        setPending(records);
    };

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
                await Promise.all([fetchPending(), fetchNeedsReview(), fetchLogs()]);
            } catch (error) {
                console.error('Error loading follow-ups:', error);
            } finally {
                setLoading(false);
            }
        };
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [timezone]);

    const sendFollowUps = async (ids: string[]) => {
        const res = await fetch('/api/send-followup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservationIds: ids }),
        });
        const data = await res.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to send');
        }
        return data as { sent: number; failed: number; results: { id: string; success: boolean }[] };
    };

    const handleSendOne = async (id: string) => {
        setSending((prev) => new Set(prev).add(id));
        try {
            const data = await sendFollowUps([id]);
            if (data.sent > 0) {
                setPending((prev) => prev.filter((r) => r.id !== id));
                setSelected((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
                toast.success('Follow-up sent');
                fetchLogs();
            } else {
                toast.error('Could not send follow-up');
            }
        } catch (error) {
            console.error('Error sending follow-up:', error);
            toast.error('Failed to send follow-up');
        } finally {
            setSending((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const handleSendBatch = async (ids: string[]) => {
        if (ids.length === 0) return;
        setSendingAll(true);
        try {
            const data = await sendFollowUps(ids);
            const sentIds = new Set(data.results.filter((r) => r.success).map((r) => r.id));
            setPending((prev) => prev.filter((r) => !sentIds.has(r.id)));
            setSelected((prev) => {
                const next = new Set(prev);
                sentIds.forEach((id) => next.delete(id));
                return next;
            });
            if (data.sent > 0) toast.success(`Sent ${data.sent} follow-up email${data.sent === 1 ? '' : 's'}`);
            if (data.failed > 0) toast.error(`${data.failed} failed to send`);
            fetchLogs();
        } catch (error) {
            console.error('Error sending follow-ups:', error);
            toast.error('Failed to send follow-ups');
        } finally {
            setSendingAll(false);
        }
    };

    const toggleSelected = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

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

    const readyIds = pending.filter((r) => r.ready).map((r) => r.id);

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
                        Send post-visit follow-up emails for the last 7 days, review unanswered ones, and check past activity.
                    </p>
                </div>

                <div className="flex gap-2 mb-6 flex-wrap">
                    <button
                        onClick={() => setTab('send')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            tab === 'send' ? 'bg-rose-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                        }`}
                    >
                        <Mail className="w-4 h-4" />
                        Send Follow-Ups {pending.length > 0 && `(${pending.length})`}
                    </button>
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
                ) : tab === 'send' ? (
                    pending.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-md p-8 text-center text-gray-500">
                            <Mail className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                            No follow-ups pending for the last 7 days.
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                <button
                                    onClick={() => handleSendBatch(readyIds)}
                                    disabled={sendingAll || readyIds.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sendingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Send All Ready ({readyIds.length})
                                </button>
                                <button
                                    onClick={() => handleSendBatch(Array.from(selected))}
                                    disabled={sendingAll || selected.size === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Send className="w-4 h-4" />
                                    Send Selected ({selected.size})
                                </button>
                            </div>

                            <div className="bg-white rounded-xl shadow-md overflow-hidden divide-y">
                                {pending.map((record) => (
                                    <div key={record.id} className="flex items-center justify-between gap-4 p-4 flex-wrap">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(record.id)}
                                                onChange={() => toggleSelected(record.id)}
                                                className="w-4 h-4 accent-rose-500"
                                            />
                                            <div className="min-w-0">
                                                <p className="font-medium text-gray-900">{record.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {record.date ? formatReadableDatePST(record.date, timezone) : 'Unknown date'} · {record.time || '—'} · {record.guests} {record.guests === 1 ? 'guest' : 'guests'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {record.ready ? (
                                                <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs">Ready</span>
                                            ) : (
                                                <span className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-xs">Not yet due</span>
                                            )}
                                            <button
                                                onClick={() => handleSendOne(record.id)}
                                                disabled={sending.has(record.id) || sendingAll}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {sending.has(record.id) ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                Send
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )
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
                        No follow-up activity recorded yet.
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
