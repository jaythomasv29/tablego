'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { toast } from 'react-hot-toast';
import AdminLayout from '@/components/AdminLayout';
import PageTransition from '@/components/PageTransition';

interface BannerData {
    text: string;
    link?: string;
    linkText?: string;
}

export default function BannerManagement() {
    const [bannerData, setBannerData] = useState<BannerData>({ text: '', link: '', linkText: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [preview, setPreview] = useState(false);

    useEffect(() => {
        const fetchBannerData = async () => {
            try {
                const bannerDoc = await getDoc(doc(db, 'settings', 'banner'));
                if (bannerDoc.exists()) {
                    setBannerData(bannerDoc.data() as BannerData);
                }
            } catch (error) {
                console.error('Error fetching banner data:', error);
                toast.error('Failed to load banner data');
            }
        };
        fetchBannerData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await setDoc(doc(db, 'settings', 'banner'), {
                text: bannerData.text,
                ...(bannerData.link && { link: bannerData.link }),
                ...(bannerData.linkText && { linkText: bannerData.linkText }),
                updatedAt: new Date().toISOString(),
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
                <div className="max-w-4xl mx-auto p-6">
                    <h1 className="text-2xl font-bold text-foreground mb-6">Banner Management</h1>

                    <div className="bg-card rounded-lg border border-border shadow-sm p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Banner Text
                                </label>
                                <input
                                    type="text"
                                    value={bannerData.text}
                                    onChange={(e) => setBannerData(prev => ({ ...prev, text: e.target.value }))}
                                    className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="Enter banner text..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Link URL <span className="text-muted-foreground font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={bannerData.link || ''}
                                    onChange={(e) => setBannerData(prev => ({ ...prev, link: e.target.value }))}
                                    className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="https://example.com/menu.pdf"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Link Text <span className="text-muted-foreground font-normal">(Optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={bannerData.linkText || ''}
                                    onChange={(e) => setBannerData(prev => ({ ...prev, linkText: e.target.value }))}
                                    className="w-full px-4 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    placeholder="View Menu"
                                />
                                <p className="mt-2 text-sm text-muted-foreground">
                                    If not provided, "Learn More" will be used
                                </p>
                            </div>

                            {bannerData.text && preview && (
                                <div className="bg-primary h-[50px] w-full flex items-center justify-center px-4 rounded-md">
                                    <p className="text-primary-foreground text-center text-sm md:text-base font-medium">
                                        {bannerData.text}
                                        {bannerData.link && (
                                            <span className="underline ml-2">
                                                {bannerData.linkText || 'Learn More'}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-4 py-2 rounded-md text-primary-foreground font-medium bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading ? 'Updating...' : 'Update Banner'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPreview(!preview)}
                                    className="px-4 py-2 text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
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
