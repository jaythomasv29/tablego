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

// Add background sync registration
self.addEventListener('sync', function (event) {
    if (event.tag === 'checkReservations') {
        event.waitUntil(checkReservationsInBackground());
    }
});

// Background check function
async function checkReservationsInBackground() {
    try {
        const response = await fetch('/api/check-reservations', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        const { pendingReservations } = await response.json();

        if (pendingReservations && pendingReservations.length > 0) {
            const reservationDetails = pendingReservations
                .map(res => `\n• ${res.name} - ${res.guests} guests at ${res.time}`)
                .join('');

            await self.registration.showNotification('New Reservations', {
                body: `You have ${pendingReservations.length} pending reservations to review:${reservationDetails}`,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                tag: 'reservation-notification',
                renotify: true
            });
        }
    } catch (error) {
        console.error('Background sync failed:', error);
    }
} 