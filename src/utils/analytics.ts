import { db } from '@/firebase';
import { collection, doc, increment, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';

export async function trackPageView(page: string) {
    if (!page) {
        console.warn('No page provided to trackPageView');
        return;
    }

    // Sanitize the page path to be a valid document ID
    const pageId = page.replace(/\//g, '_').replace(/^_+|_+$/g, '');

    try {
        // Create a simpler document reference structure
        // analytics (collection) / pageviews (document) / pages (collection) / {pageId} (document)
        const pageviewsDoc = doc(db, 'analytics', 'pageviews');
        const pagesCollection = collection(pageviewsDoc, 'pages');
        const pageRef = doc(pagesCollection, pageId);

        // Update only the total views
        await setDoc(pageRef, {
            page: pageId,
            views: increment(1),
            lastVisit: serverTimestamp()
        }, { merge: true });

        console.log('Successfully tracked page view:', pageId);
    } catch (error) {
        console.error('Error tracking page view:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}

export async function getTotalPageViews() {
    try {
        const pageviewsDoc = doc(db, 'analytics', 'pageviews');
        const pagesCollection = collection(pageviewsDoc, 'pages');
        const snapshot = await getDocs(pagesCollection);

        let totalViews = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.views) {
                totalViews += data.views;
            }
        });

        return totalViews;
    } catch (error) {
        console.error('Error getting total page views:', error);
        return 0;
    }
}