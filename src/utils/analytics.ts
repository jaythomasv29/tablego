import { db } from '@/firebase';
import { collection, doc, increment, addDoc, setDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';

export async function trackPageView(page: string) {
    if (!page) {
        console.warn('No page provided to trackPageView');
        return;
    }

    const now = new Date();
    const day = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const month = day.substring(0, 7); // YYYY-MM
    const year = day.substring(0, 4); // YYYYx`

    try {
        // Create collection references with proper structure
        const analyticsRef = collection(db, 'analytics');
        const totalRef = doc(analyticsRef, 'total');
        const dailyRef = doc(analyticsRef, 'daily');
        const monthlyRef = doc(analyticsRef, 'monthly');
        const yearlyRef = doc(analyticsRef, 'yearly');

        // Create subcollections for each time period
        const totalPagesRef = collection(totalRef, 'pages');
        const dailyPagesRef = collection(dailyRef, 'pages');
        const monthlyPagesRef = collection(monthlyRef, 'pages');
        const yearlyPagesRef = collection(yearlyRef, 'pages');

        // Update all documents in parallel
        await Promise.all([
            setDoc(doc(totalPagesRef, page), {
                page,
                views: increment(1),
                lastVisit: serverTimestamp()
            }, { merge: true }),

            addDoc(dailyPagesRef, {
                page,
                date: day,
                period: 'daily',
                views: increment(1),
                lastVisit: serverTimestamp()
            }),

            addDoc(monthlyPagesRef, {
                page,
                date: month,
                period: 'monthly',
                views: increment(1),
                lastVisit: serverTimestamp()
            }),

            addDoc(yearlyPagesRef, {
                page,
                date: year,
                period: 'yearly',
                views: increment(1),
                lastVisit: serverTimestamp()
            })
        ]);

        console.log('Successfully tracked page view across all time periods');
    } catch (error) {
        console.error('Error tracking page view:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}

export async function getDailyPageViews(days: number = 7) {
    try {
        const analyticsRef = collection(db, 'analytics');
        const dailyRef = doc(analyticsRef, 'daily');
        const dailyPagesRef = collection(dailyRef, 'pages');

        // Get date for 7 days ago
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get all daily views
        const snapshot = await getDocs(dailyPagesRef);

        // Process and aggregate the data
        const dailyData: { [key: string]: number } = {};

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.date && data.views) {
                // Add views to the corresponding date
                dailyData[data.date] = (dailyData[data.date] || 0) + data.views;
            }
        });

        // Convert to array and sort by date
        const sortedData = Object.entries(dailyData)
            .map(([date, views]) => ({ date, views }))
            .filter(item => new Date(item.date) >= startDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return sortedData;
    } catch (error) {
        console.error('Error getting daily page views:', error);
        return [];
    }
}

export async function getTotalPageViews() {
    try {
        const analyticsRef = collection(db, 'analytics');
        const totalRef = doc(analyticsRef, 'total');
        const totalPagesRef = collection(totalRef, 'pages');

        const snapshot = await getDocs(totalPagesRef);

        // Sum up all the views from all pages
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
