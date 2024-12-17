import { db } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

export async function trackPageView(page: string) {
    if (!page) {
        console.warn('No page provided to trackPageView');
        return;
    }

    try {
        const pageViewRef = doc(db, 'analytics', page);

        await setDoc(pageViewRef, {
            page,
            views: increment(1),
            lastVisit: serverTimestamp()
        }, { merge: true });

        console.log('Successfully tracked page view');
    } catch (error) {
        console.error('Error tracking page view:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}
