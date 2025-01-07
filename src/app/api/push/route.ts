import webpush from 'web-push';
import { NextResponse } from 'next/server';
import { collection, getDocs, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebase';
import { PushSubscription } from 'web-push';

if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys must be set');
}

webpush.setVapidDetails(
    'mailto:jvongampai@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

export async function POST(req: Request) {
    try {
        console.log('Push notification endpoint hit');
        const { message } = await req.json();
        console.log('Message received:', message);

        // Get subscriptions and send notifications
        const subscriptionsRef = collection(db, 'pushSubscriptions');
        const snapshot = await getDocs(subscriptionsRef);
        console.log('Found subscriptions:', snapshot.size);

        if (snapshot.size === 0) {
            console.log('No subscriptions found');
            return NextResponse.json({
                success: false,
                message: 'No subscriptions found'
            });
        }

        const notifications = snapshot.docs.map(doc => {
            const subscription = doc.data() as PushSubscription;
            console.log('Sending to subscription:', subscription.endpoint);
            return webpush.sendNotification(
                subscription,
                message
            ).catch(error => {
                console.error('Error sending to subscription:', error);
            });
        });

        await Promise.all(notifications);
        console.log('Notifications sent successfully');

        // Record this notification
        await addDoc(collection(db, 'notifications'), {
            message,
            timestamp: serverTimestamp()
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error sending push notifications:', error);
        return NextResponse.json(
            { error: 'Failed to send push notifications' },
            { status: 500 }
        );
    }
} 