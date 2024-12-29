import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const projectId = process.env.VERCEL_PROJECT_ID;
        const token = process.env.VERCEL_TOKEN;

        if (!projectId || !token) {
            throw new Error('Missing required environment variables');
        }

        // Verify token works
        const response = await fetch(
            `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            const text = await response.text();
            console.error('Vercel API Error:', {
                status: response.status,
                statusText: response.statusText,
                body: text
            });
            throw new Error(`API responded with status ${response.status}`);
        }

        // Generate last 7 days of mock data
        const dailyViews = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - i);
            return {
                date: date.toISOString(),
                views: Math.floor(Math.random() * 500) + 100, // Random between 100-600
                uniqueVisitors: Math.floor(Math.random() * 300) + 50, // Random between 50-350
            };
        }).reverse();

        // Calculate totals and changes
        const currentTotal = dailyViews.slice(-7).reduce((sum, day) => sum + day.views, 0);
        const previousTotal = dailyViews.slice(-14, -7).reduce((sum, day) => sum + day.views, 0);
        const percentageChange = previousTotal === 0 ? 0 :
            ((currentTotal - previousTotal) / previousTotal) * 100;

        return NextResponse.json({
            pageViews: {
                value: currentTotal,
                change: Math.round(percentageChange * 10) / 10
            },
            visitors: {
                value: dailyViews.reduce((sum, day) => sum + day.uniqueVisitors, 0),
                change: 12.5 // Mock percentage change
            },
            dailyViews,
            topPages: [
                { path: '/', views: 450, uniqueVisitors: 280 },
                { path: '/menu', views: 320, uniqueVisitors: 180 },
                { path: '/reservations', views: 280, uniqueVisitors: 150 },
                { path: '/contact', views: 150, uniqueVisitors: 90 },
            ],
            deviceBreakdown: {
                mobile: 55,
                desktop: 35,
                tablet: 10
            }
        });
    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}
