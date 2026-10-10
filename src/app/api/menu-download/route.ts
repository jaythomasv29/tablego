import { NextResponse } from 'next/server';
import { getServerDatabase } from '@/lib/serverFirebase';

export async function GET() {
    try {
        await getServerDatabase().collection('menuDownloads').add({
            type: 'download',
            source: 'email',
            timestamp: new Date(),
        });
    } catch (e) {
        console.error('Failed to track menu download:', e);
    }

    return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/images/Thaiphoon_Food_Pics/Thaiphoon Dinner Menu.pdf`
    );
}
