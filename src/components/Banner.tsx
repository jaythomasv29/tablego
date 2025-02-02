'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface BannerData {
    text: string;
    link?: string;
    linkText?: string;
}

export default function Banner() {
    const [bannerData, setBannerData] = useState<BannerData | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchBannerData = async () => {
            try {
                const bannerDoc = await getDoc(doc(db, 'settings', 'banner'));
                if (bannerDoc.exists() && bannerDoc.data().text) {
                    setBannerData(bannerDoc.data() as BannerData);
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            } catch (error) {
                console.error('Error fetching banner text:', error);
                setIsVisible(false);
            }
        };

        fetchBannerData();
    }, []);

    if (!isVisible || !bannerData) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-600 h-[50px] w-full flex items-center justify-center px-4"
        >
            <p className="text-white text-center text-sm md:text-base font-medium">
                {bannerData.text}
                {bannerData.link && (
                    <>
                        {' '}
                        <Link
                            href={bannerData.link}
                            className="underline hover:text-gray-200 transition-colors ml-2"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {bannerData.linkText || 'Learn More'}
                        </Link>
                    </>
                )}
            </p>
        </motion.div>
    );
}
