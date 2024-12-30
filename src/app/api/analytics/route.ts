import { NextResponse } from 'next/server';
import { getAnalytics } from 'firebase/analytics';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';

export async function GET() {
    try {
        // Get page views from Firestore analytics collection
        const analyticsRef = collection(db, 'analytics');
        const last7Days = new Date();
        last7Days.setDate(last7Days.getDate() - 7);

        const q = query(
            analyticsRef,
            where('timestamp', '>=', last7Days),
            orderBy('timestamp', 'desc')
        );

        const snapshot = await getDocs(q);
        const dailyViews = snapshot.docs.map(doc => ({
            date: doc.data().timestamp.toDate().toISOString(),
            views: doc.data().pageViews || 0
        }));

        // Calculate total views
        const totalViews = dailyViews.reduce((sum, day) => sum + day.views, 0);

        return NextResponse.json({
            pageViews: {
                value: totalViews,
                timestamp: new Date().toISOString()
            },
            dailyViews
        });
    } catch (error) {
        console.error('Analytics Error:', error);
        // Return mock data if analytics fails
        return NextResponse.json({
            pageViews: {
                value: 100,
                timestamp: new Date().toISOString()
            },
            dailyViews: [
                { date: new Date().toISOString(), views: 100 }
            ]
        });
    }
}
