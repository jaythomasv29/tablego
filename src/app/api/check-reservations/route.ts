import { NextResponse } from 'next/server';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';

export async function GET() {
    try {
        const q = query(
            collection(db, 'reservations'),
            where('status', '==', 'pending')
        );

        const snapshot = await getDocs(q);
        const pendingReservations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return NextResponse.json({ pendingReservations });
    } catch (error) {
        console.error('Error checking reservations:', error);
        return NextResponse.json({ error: 'Failed to check reservations' }, { status: 500 });
    }
} 