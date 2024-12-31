"use client"
import { useState } from 'react';
import { X, MessageCircle, Send } from 'lucide-react';
import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ContactFormData {
    name: string;
    email: string;
    message: string;
}

export default function FloatingContactButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'info' | 'message'>('info');
    const [formData, setFormData] = useState<ContactFormData>({
        name: '',
        email: '',
        message: ''
    });
    const [isSending, setIsSending] = useState(false);

    const handleSubmitInfo = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.name && formData.email) {
            setStep('message');
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        try {
            await addDoc(collection(db, 'messages'), {
                ...formData,
                status: 'unread',
                timestamp: serverTimestamp()
            });
            toast.success('Message sent successfully!');
            setIsOpen(false);
            setStep('info');
            setFormData({ name: '', email: '', message: '' });
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error('Failed to send message');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-all hover:scale-105 flex items-center gap-2"
            >
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Contact Business</span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center">
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)} />

                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 sm:w-96 animate-slide-up">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        {step === 'info' ? (
                            <>
                                <h3 className="text-xl font-semibold text-gray-900 mb-1">Contact Business</h3>
                                <p className="text-sm text-gray-500 mb-6">Please provide your contact information</p>
                                <form onSubmit={handleSubmitInfo} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="Your name"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                            placeholder="your@email.com"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        Continue
                                        <Send className="h-4 w-4" />
                                    </button>
                                </form>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xl font-semibold text-gray-900 mb-1">Write Message</h3>
                                <p className="text-sm text-gray-500 mb-6">What would you like to ask?</p>
                                <form onSubmit={handleSendMessage} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                        <textarea
                                            required
                                            rows={4}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                            placeholder="Type your message here..."
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={isSending}
                                        className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400 flex items-center justify-center gap-2"
                                    >
                                        {isSending ? (
                                            <>
                                                <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                Send Message
                                                <Send className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
} 