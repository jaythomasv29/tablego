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
        // First, request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Notification permission denied');
        }

        const registration = await navigator.serviceWorker.ready;

        // Get the push subscription
        let subscription = await registration.pushManager.getSubscription();

        // If no subscription, create one
        if (!subscription) {
            const response = await fetch('/api/vapidPublicKey');
            const vapidPublicKey = await response.text();

            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
        }

        // Send the subscription to your server
        await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription)
        });

        return subscription;
    } catch (error) {
        console.error('Error subscribing to push notifications:', error);
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