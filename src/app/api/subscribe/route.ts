import { NextResponse } from 'next/server';
import { collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '@/firebase';

export async function POST(req: Request) {
    try {
        const subscription = await req.json();

        // Store subscription in Firestore
        const subscriptionsRef = collection(db, 'pushSubscriptions');

        // Check if subscription already exists
        const q = query(subscriptionsRef, where('endpoint', '==', subscription.endpoint));
        const existingDocs = await getDocs(q);

        // Remove existing subscriptions for this endpoint
        existingDocs.forEach(async (doc) => {
            await deleteDoc(doc.ref);
        });

        // Add new subscription
        await addDoc(subscriptionsRef, {
            ...subscription,
            timestamp: new Date()
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving push subscription:', error);
        return NextResponse.json(
            { error: 'Failed to save subscription' },
            { status: 500 }
        );
    }
} 