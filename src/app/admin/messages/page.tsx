'use client';

import { useEffect, useState } from 'react';
import AdminLayout from '@/components/AdminLayout';
import { collection, getDocs, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import toast from 'react-hot-toast';

interface Message {
    id: string;
    name: string;
    email: string;
    message: string;
    timestamp: Date;
    status: 'read' | 'unread';
}

export default function MessagesPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isMarkingRead, setIsMarkingRead] = useState<string>('');
    const [loading, setLoading] = useState(true);

    const fetchMessages = async () => {
        try {
            const messagesRef = collection(db, 'messages');
            const q = query(messagesRef, orderBy('timestamp', 'desc'));
            const snapshot = await getDocs(q);
            const messagesList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp?.toDate() || new Date()
            })) as Message[];
            setMessages(messagesList);
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleMarkAsRead = async (messageId: string) => {
        setIsMarkingRead(messageId);
        try {
            const messageRef = doc(db, 'messages', messageId);
            await updateDoc(messageRef, {
                status: 'read'
            });
            await fetchMessages();
            toast.success('Message marked as read');
        } catch (error) {
            console.error('Error marking message as read:', error);
            toast.error('Failed to mark message as read');
        } finally {
            setIsMarkingRead('');
        }
    };

    return (
        <AdminLayout>
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Messages</h1>
                <p className="text-gray-600">
                    {messages.filter(m => m.status === 'unread').length} unread messages
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md p-6">
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`border-b pb-4 last:border-0 last:pb-0 ${message.status === 'unread' ? 'bg-blue-50 p-4 rounded-lg' : ''
                                    }`}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-medium text-gray-900">{message.name}</p>
                                        <p className="text-sm text-gray-600">{message.email}</p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {message.timestamp.toLocaleDateString()} at{' '}
                                            {message.timestamp.toLocaleTimeString()}
                                        </p>
                                        <p className="mt-2 text-gray-700">{message.message}</p>
                                    </div>
                                    {message.status === 'unread' && (
                                        <button
                                            onClick={() => handleMarkAsRead(message.id)}
                                            disabled={isMarkingRead === message.id}
                                            className="px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-600 hover:bg-blue-100"
                                        >
                                            {isMarkingRead === message.id ? 'Marking...' : 'Mark as Read'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {messages.length === 0 && (
                            <p className="text-center text-gray-500 py-4">
                                No messages yet
                            </p>
                        )}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
} 