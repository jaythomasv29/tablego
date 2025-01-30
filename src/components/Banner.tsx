'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/firebase';
import { motion } from 'framer-motion';

export default function Banner() {
    const [bannerText, setBannerText] = useState('');
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchBannerText = async () => {
            try {
                const bannerDoc = await getDoc(doc(db, 'settings', 'banner'));
                if (bannerDoc.exists() && bannerDoc.data().text) {
                    setBannerText(bannerDoc.data().text);
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            } catch (error) {
                console.error('Error fetching banner text:', error);
                setIsVisible(false);
            }
        };

        fetchBannerText();
    }, []);

    if (!isVisible || !bannerText) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-indigo-600 h-[50px] w-full flex items-center justify-center px-4"
        >
            <p className="text-white text-center text-sm md:text-base font-medium">
                {bannerText}
            </p>
        </motion.div>
    );
}
