import webpush from 'web-push';
import { NextResponse } from 'next/server';
import { collection, getDocs, addDoc, query, where, orderBy, limit, serverTimestamp } from 'firebase/firestore';
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
        const { message } = await req.json();

        // Check last notification time
        const notificationsRef = collection(db, 'notifications');
        const lastNotificationQuery = query(
            notificationsRef,
            orderBy('timestamp', 'desc'),
            limit(1)
        );
        const lastNotificationSnapshot = await getDocs(lastNotificationQuery);

        // Only check time if there was a previous notification
        if (lastNotificationSnapshot.size > 0) {
            const lastNotification = lastNotificationSnapshot.docs[0].data();
            const timeSinceLastNotification = Date.now() - lastNotification.timestamp.toMillis();

            if (timeSinceLastNotification < 5 * 60 * 1000) {
                console.log('Skipping notification - too soon:', Math.floor(timeSinceLastNotification / 1000), 'seconds since last');
                return NextResponse.json({
                    success: false,
                    message: 'Too soon for another notification'
                });
            }
        }

        // Record this notification using serverTimestamp for consistency
        await addDoc(notificationsRef, {
            message,
            timestamp: serverTimestamp()
        });

        // Get subscriptions and send notifications
        const subscriptionsRef = collection(db, 'pushSubscriptions');
        const snapshot = await getDocs(subscriptionsRef);

        const notifications = snapshot.docs.map(doc => {
            const subscription = doc.data() as PushSubscription;
            return webpush.sendNotification(
                subscription,
                message
            ).catch(error => {
                console.error('Error sending to subscription:', error);
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