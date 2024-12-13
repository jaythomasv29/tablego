import { db } from '@/firebase';
import { doc, increment, setDoc, serverTimestamp } from 'firebase/firestore';

export async function trackPageView(page: string) {
    if (!page) {
        console.warn('No page provided to trackPageView');
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const pageViewRef = doc(db, 'analytics', `${page}_${today}`);

        console.log('Tracking page view:', {
            page,
            docId: `${page}_${today}`,
            collection: 'analytics'
        });

        await setDoc(pageViewRef, {
            page,
            date: today,
            views: increment(1),
            lastVisit: serverTimestamp()
        }, { merge: true });

        console.log('Successfully tracked page view');
    } catch (error) {
        console.error('Error tracking page view:', error);
        // Log the full error details
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}
