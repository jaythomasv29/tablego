'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ReminderModalProps {
    isOpen: boolean;
    isLoading: boolean;
    success: boolean;
    error: string | null;
    onClose: () => void;
    totalEmails: number;
    sentEmails: number;
}

export default function ReminderModal({
    isOpen,
    isLoading,
    success,
    error,
    onClose,
    totalEmails,
    sentEmails
}: ReminderModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 relative"
                >
                    {isLoading ? (
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">
                                Sending reminders... ({sentEmails}/{totalEmails})
                            </p>
                        </div>
                    ) : error ? (
                        <div className="text-center">
                            <svg className="w-12 h-12 text-red-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <h3 className="text-lg font-semibold text-gray-900 mt-4">Error</h3>
                            <p className="text-gray-600 mt-2">{error}</p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    ) : success ? (
                        <div className="text-center">
                            <svg className="w-12 h-12 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <h3 className="text-lg font-semibold text-gray-900 mt-4">Success!</h3>
                            <p className="text-gray-600 mt-2">
                                {totalEmails === 1
                                    ? 'Reminder sent successfully'
                                    : `All ${totalEmails} reminders sent successfully`
                                }
                            </p>
                            <button
                                onClick={onClose}
                                className="mt-4 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                            >
                                Close
                            </button>
                        </div>
                    ) : null}
                </motion.div>
            </div>
        </AnimatePresence>
    );
} 