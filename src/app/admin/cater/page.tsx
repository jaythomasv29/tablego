'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import {
    Loader2,
    Calendar,
    Clock,
    Users,
    Mail,
    Phone,
    MessageSquare,
    Search,
    Inbox,
} from 'lucide-react';
import AdminLayout from '@/components/AdminLayout';
import toast from 'react-hot-toast';

interface CateringOrder {
    id: string;
    name: string;
    email: string;
    phone: string;
    date: string;
    time: string;
    guests: number;
    status: 'pending' | 'completed';
    message?: string;
    selectedDishes?: Array<
        string | {
            id?: string;
            name?: string;
            description?: string;
            imageUrl?: string;
        }
    >;
    createdAt: { toDate: () => Date } | string;
}

type StatusFilter = 'all' | 'pending' | 'completed';

const toDate = (value: { toDate: () => Date } | string | undefined): Date | null => {
    if (!value) return null;
    try {
        if (typeof value === 'object' && 'toDate' in value) return value.toDate();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
        return null;
    }
};

const formatDate = (date: { toDate: () => Date } | string) => {
    if (!date) return '-';

    try {
        // If it's a Firebase Timestamp (has toDate method)
        if (typeof date === 'object' && 'toDate' in date) {
            return date.toDate().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }

        // If it's a string
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return '-';
    }
};

const formatDateTime = (date: { toDate: () => Date } | string) => {
    const parsed = toDate(date);
    if (!parsed) return '-';
    return parsed.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const getSelectedDishNames = (order: CateringOrder): string[] => {
    if (!order.selectedDishes || !Array.isArray(order.selectedDishes)) return [];
    return order.selectedDishes
        .map((dish) => {
            if (typeof dish === 'string') return dish.trim();
            if (dish && typeof dish === 'object') return (dish.name || dish.id || '').trim();
            return '';
        })
        .filter(Boolean);
};

export default function CateringPage() {
    const [orders, setOrders] = useState<CateringOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'catering'));
                const ordersData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as CateringOrder[];

                setOrders(ordersData);
                setLoading(false);
            } catch (error) {
                console.error('Error fetching orders:', error);
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const normalizedOrders = [...orders].sort((a, b) => {
        const aDate = toDate(a.createdAt)?.getTime() ?? 0;
        const bDate = toDate(b.createdAt)?.getTime() ?? 0;
        return bDate - aDate;
    });

    const filteredOrders = normalizedOrders.filter((order) => {
        const matchesSearch = !searchTerm.trim() ||
            order.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.phone.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || (order.status || 'pending') === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const pendingCount = orders.filter(o => (o.status || 'pending') === 'pending').length;
    const completedCount = orders.filter(o => o.status === 'completed').length;

    const handleMarkComplete = async (orderId: string) => {
        try {
            setUpdatingOrderId(orderId);
            await updateDoc(doc(db, 'catering', orderId), { status: 'completed' });
            setOrders(prev => prev.map(order =>
                order.id === orderId ? { ...order, status: 'completed' } : order
            ));
            toast.success('Lead marked as completed');
        } catch (error) {
            console.error('Error updating catering lead status:', error);
            toast.error('Failed to update status');
        } finally {
            setUpdatingOrderId(null);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="max-w-7xl mx-auto px-4 py-8 w-full">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Catering Leads</h1>
                    <p className="text-gray-500 mt-1">Track and review incoming catering inquiries in one place.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Total Leads</div>
                        <div className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</div>
                    </div>
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="text-xs text-amber-600 uppercase tracking-wide">Pending</div>
                        <div className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</div>
                    </div>
                    <div className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="text-xs text-green-600 uppercase tracking-wide">Completed</div>
                        <div className="text-2xl font-bold text-green-700 mt-1">{completedCount}</div>
                    </div>
                </div>

                <div className="bg-white border rounded-xl p-3 sm:p-4 shadow-sm mb-5">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, email, or phone..."
                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {(['all', 'pending', 'completed'] as StatusFilter[]).map((status) => {
                                const isActive = statusFilter === status;
                                return (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                                            isActive
                                                ? 'bg-blue-600 border-blue-600 text-white'
                                                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {status[0].toUpperCase() + status.slice(1)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {filteredOrders.length === 0 ? (
                    <div className="bg-white border rounded-xl p-10 text-center shadow-sm">
                        <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">No catering leads match your filters.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredOrders.map((order) => {
                            const [displayTime, displayPeriod] = (order.time || '').split(' ');
                            const status = order.status || 'pending';
                            const isPending = status === 'pending';
                            const selectedDishNames = getSelectedDishNames(order);

                            return (
                                <div
                                    key={order.id}
                                    className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
                                        isPending ? 'border-amber-200' : 'border-green-200'
                                    }`}
                                >
                                    <div className="flex items-stretch">
                                        <div className="w-28 sm:w-32 border-r bg-gray-50 flex items-center justify-center px-2">
                                            <div className="text-center leading-none">
                                                <div className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900">
                                                    {displayTime || '--:--'}
                                                </div>
                                                {displayPeriod && (
                                                    <div className="text-[11px] sm:text-xs font-semibold text-gray-500 mt-1 tracking-wide">
                                                        {displayPeriod}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex-1 p-4">
                                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                                                <div>
                                                    <h3 className="font-semibold text-gray-900">{order.name}</h3>
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        Submitted: {formatDateTime(order.createdAt)}
                                                    </div>
                                                </div>
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                                                    isPending
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-green-100 text-green-800'
                                                }`}>
                                                    {status}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 mb-3">
                                                <span className="flex items-center">
                                                    <Calendar className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                                    Event Date: {formatDate(order.date)}
                                                </span>
                                                <span className="flex items-center">
                                                    <Users className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                                    {order.guests} {order.guests === 1 ? 'guest' : 'guests'}
                                                </span>
                                            </div>

                                            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 mb-3">
                                                <a href={`mailto:${order.email}`} className="flex items-center hover:text-blue-600 transition-colors">
                                                    <Mail className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                                    {order.email}
                                                </a>
                                                <a href={`tel:${order.phone}`} className="flex items-center hover:text-blue-600 transition-colors">
                                                    <Phone className="w-3.5 h-3.5 mr-1 text-gray-400" />
                                                    {order.phone}
                                                </a>
                                            </div>

                                            <div className="text-sm text-gray-700 bg-gray-50 border rounded-lg p-2.5">
                                                <div className="flex items-start">
                                                    <MessageSquare className="w-3.5 h-3.5 mr-1.5 mt-0.5 text-gray-400 flex-shrink-0" />
                                                    <p className="line-clamp-3">
                                                        {order.message?.trim() || 'No message provided.'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-2 text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5">
                                                <div className="font-medium text-xs text-blue-700 mb-1">
                                                    Selected Dishes ({selectedDishNames.length})
                                                </div>
                                                {selectedDishNames.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {selectedDishNames.map((dishName, index) => (
                                                            <span
                                                                key={`${dishName}-${index}`}
                                                                className="inline-flex px-2 py-0.5 text-xs rounded-full bg-white border border-blue-200 text-blue-700"
                                                            >
                                                                {dishName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500">No dishes selected.</p>
                                                )}
                                            </div>

                                            <div className="flex justify-end mt-3 border-t pt-3">
                                                <button
                                                    onClick={() => handleMarkComplete(order.id)}
                                                    disabled={!isPending || updatingOrderId === order.id}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                                        isPending
                                                            ? 'border-green-300 text-green-700 bg-green-50 hover:bg-green-100'
                                                            : 'border-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed'
                                                    }`}
                                                    title={isPending ? 'Mark this lead as completed' : 'Lead already completed'}
                                                >
                                                    {updatingOrderId === order.id ? 'Updating...' : isPending ? 'Mark Complete' : 'Completed'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
