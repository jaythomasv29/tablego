import { toast } from "react-hot-toast";

export function registerServiceWorker() {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker
            .register('/sw.js')
            .then(function (registration) {
                console.log('ServiceWorker registration successful');
                return registration;
            })
            .catch(function (err) {
                console.log('ServiceWorker registration failed: ', err);
            });
    }
}

export async function subscribeToPushNotifications() {
    try {
        // Check if notifications are already denied
        if (Notification.permission === 'denied') {
            toast.error('Please enable notifications in your browser settings');
            throw new Error('Notifications are blocked');
        }

        // If permission is not determined, request it
        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                toast.error('Please allow notifications to receive updates');
                throw new Error('Notification permission denied');
            }
        }

        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            const response = await fetch('/api/vapidPublicKey');
            const vapidPublicKey = await response.text();
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription)
        });

        return subscription;
    } catch (error: any) {
        console.error('Error subscribing to push notifications:', error);
        // Don't throw error if notifications are blocked
        if (error.message !== 'Notifications are blocked') {
            throw error;
        }
    }
}

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
} 