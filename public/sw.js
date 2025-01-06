self.addEventListener('push', function (event) {
    const message = event.data.text();

    const options = {
        body: message,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            {
                action: 'explore',
                title: 'View Details',
            }
        ],
        tag: 'reservation-notification',
        renotify: true
    };

    event.waitUntil(
        self.registration.showNotification('New Reservation', options)
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    if (event.action === 'explore') {
        clients.openWindow('/admin/home');
    }
}); 