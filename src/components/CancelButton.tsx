import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useState } from 'react';
import Cookies from 'js-cookie'; // Make sure this is imported

interface CancelButtonProps {
  onSuccess?: () => void;
}

export default function CancelButton({ onSuccess }: { onSuccess?: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleCancel = async () => {
    const reservationId = Cookies.get('reservationId');

    if (!reservationId) {
      alert('No reservation ID found in cookies. Please make sure you have an active reservation.');
      return;
    }

    if (window.confirm('Are you sure you want to cancel this reservation?')) {
      setIsLoading(true);
      try {
        const reservationRef = doc(db, 'reservations', reservationId);

        await updateDoc(reservationRef, {
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        // Clear both cookies
        Cookies.remove('reservationId');
        Cookies.remove('lastReservation');

        alert('Reservation cancelled successfully');

        // Call onSuccess callback and reload the page
        onSuccess?.();
        window.location.reload();

      } catch (error) {
        console.error('Error canceling reservation:', error);
        alert(`Failed to cancel reservation: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={isLoading}
      className="bg-red-600 hover:bg-red-700 inline-flex items-center px-6 py-3 text-white text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 mx-2"
    >
      {isLoading ? 'Canceling...' : 'Cancel/Edit Reservation'}
    </button>
  );
}