import { NextResponse } from 'next/server';
import { getServerDatabase } from '@/lib/serverFirebase';
import { restaurantIdentity } from '@/lib/restaurant/config';

export async function GET(request: Request) {
    const db = getServerDatabase();
    const general = (await db.doc('settings/general').get()).data();
    const restaurant = restaurantIdentity(general?.restaurant);
    try {
        await db.collection('menuDownloads').add({ type: 'download', source: 'email', timestamp: new Date() });
    } catch { console.error('Failed to track menu download'); }
    return NextResponse.redirect(new URL(restaurant.menuPdf, process.env.NEXT_PUBLIC_BASE_URL || request.url));
}
