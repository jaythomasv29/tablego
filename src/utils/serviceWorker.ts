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