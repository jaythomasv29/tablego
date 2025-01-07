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
        console.log('Requesting notification permission');
        if (Notification.permission === 'denied') {
            console.log('Notifications are blocked');
            toast.error('Please enable notifications in your browser settings');
            throw new Error('Notifications are blocked');
        }

        if (Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            console.log('Permission result:', permission);
            if (permission !== 'granted') {
                toast.error('Please allow notifications to receive updates');
                throw new Error('Notification permission denied');
            }
        }

        const registration = await navigator.serviceWorker.ready;
        console.log('Service Worker ready');

        let subscription = await registration.pushManager.getSubscription();
        console.log('Existing subscription:', subscription);

        if (!subscription) {
            const response = await fetch('/api/vapidPublicKey');
            const vapidPublicKey = await response.text();
            console.log('VAPID key received');

            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
            console.log('New subscription created');
        }

        console.log('Saving subscription to server');
        await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription)
        });
        console.log('Subscription saved successfully');

        return subscription;
    } catch (error) {
        console.error('Push notification setup error:', error);
        throw error;
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