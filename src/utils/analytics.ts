import { db } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export const trackPageView = async (page: string) => {
    try {
        await addDoc(collection(db, 'analytics'), {
            page,
            pageViews: 1,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Error tracking page view:', error);
    }
};