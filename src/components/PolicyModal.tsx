import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface PolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

const PolicyModal: React.FC<PolicyModalProps> = ({ isOpen, onClose, children }) => {
    const modalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop - reduce opacity from 60% to 30% */}
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center p-4 sm:p-6 md:p-8">
                <div
                    ref={modalRef}
                    className="relative w-full max-w-lg bg-white rounded-lg shadow-xl overflow-y-auto max-h-[90vh]"
                >
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>

                    {/* Content */}
                    <div className="p-4 sm:p-6">
                        <div className="prose prose-sm max-w-none">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Reservation Policy</h3>
                            <div className="text-sm text-gray-600 space-y-2">
                                {children}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PolicyModal;