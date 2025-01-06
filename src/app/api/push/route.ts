import webpush from 'web-push';
import { NextResponse } from 'next/server';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/firebase';
import { PushSubscription } from 'web-push';

const vapidKeys = {
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!
};

webpush.setVapidDetails(
    'mailto:jvongampai@gmail.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

export async function POST(req: Request) {
    try {
        const { message } = await req.json();

        // Get all subscriptions from Firestore
        const subscriptionsRef = collection(db, 'pushSubscriptions');
        const snapshot = await getDocs(subscriptionsRef);

        // Send notification to all subscribed devices
        const notifications = snapshot.docs.map(doc => {
            const subscription = doc.data() as PushSubscription;
            return webpush.sendNotification(
                subscription,
                JSON.stringify({
                    title: 'New Reservation',
                    body: message
                })
            ).catch(error => {
                console.error('Error sending to subscription:', error);
                // Could add cleanup of invalid subscriptions here
            });
        });

        await Promise.all(notifications);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending push notifications:', error);
        return NextResponse.json(
            { error: 'Failed to send push notifications' },
            { status: 500 }
        );
    }
} 