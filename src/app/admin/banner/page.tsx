'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { toast } from 'react-hot-toast';
import AdminLayout from '@/components/AdminLayout';
import PageTransition from '@/components/PageTransition';

export default function BannerManagement() {
    const [bannerText, setBannerText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        const fetchBannerText = async () => {
            try {
                const bannerDoc = await getDoc(doc(db, 'settings', 'banner'));
                if (bannerDoc.exists()) {
                    setBannerText(bannerDoc.data().text || '');
                }
            } catch (error) {
                console.error('Error fetching banner text:', error);
                toast.error('Failed to load banner text');
            }
        };

        fetchBannerText();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await setDoc(doc(db, 'settings', 'banner'), {
                text: bannerText,
                updatedAt: new Date().toISOString()
            });
            toast.success('Banner updated successfully');
        } catch (error) {
            console.error('Error updating banner:', error);
            toast.error('Failed to update banner');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AdminLayout>
            <PageTransition>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">
                        Banner Management
                    </h1>

                    <div className="bg-white rounded-lg shadow-md p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="bannerText"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    Banner Text
                                </label>
                                <input
                                    type="text"
                                    id="bannerText"
                                    value={bannerText}
                                    onChange={(e) => setBannerText(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                    placeholder="Enter banner text..."
                                />
                                <p className="mt-2 text-sm text-gray-500">
                                    Leave empty to hide the banner
                                </p>
                            </div>

                            {/* Preview Section */}
                            {bannerText && preview && (
                                <div className="bg-indigo-600 h-[60px] w-full flex items-center justify-center px-4 rounded-md">
                                    <p className="text-white text-center text-sm md:text-base font-medium">
                                        {bannerText}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center space-x-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className={`px-4 py-2 rounded-md text-white font-medium ${isLoading
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-indigo-600 hover:bg-indigo-700'
                                        }`}
                                >
                                    {isLoading ? 'Updating...' : 'Update Banner'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreview(!preview)}
                                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    {preview ? 'Hide Preview' : 'Show Preview'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </PageTransition>
        </AdminLayout>
    );
}
