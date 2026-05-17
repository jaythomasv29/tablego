import { NextResponse } from 'next/server';
import { db } from '../../../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export async function GET() {
    try {
        await addDoc(collection(db, 'menuDownloads'), {
            type: 'download',
            source: 'email',
            timestamp: serverTimestamp(),
        });
    } catch (e) {
        console.error('Failed to track menu download:', e);
    }

    return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/images/Thaiphoon_Food_Pics/Thaiphoon Dinner Menu.pdf`
    );
}
