import { X } from 'lucide-react';
import { useState } from 'react';
import { db } from '../firebase';  // Make sure you have this firebase config
import { collection, query, where, getDocs } from 'firebase/firestore';

interface ReservationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Reservation {
    id: string;
    name: string;
    date: string;
    time: string;
    guests: number;
    email: string;
    phone: string;
    // Add other fields as needed
}

export default function ReservationModal({ isOpen, onClose }: ReservationModalProps) {
    const [searchType, setSearchType] = useState<'email' | 'phone'>('email');
    const [searchValue, setSearchValue] = useState('');
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSearching(true);

        try {
            const reservationsRef = collection(db, 'reservations');

            if (searchType === 'phone') {
                // Clean the input: remove all non-digit characters
                const cleanNumber = searchValue.replace(/\D/g, '');

                // Create two search numbers:
                // If user entered with 1, also search without it
                // If user entered without 1, also search with it
                let searchNumbers = [];
                if (cleanNumber.startsWith('1')) {
                    // If number starts with 1, also search without it
                    searchNumbers = [cleanNumber, cleanNumber.substring(1)];
                } else {
                    // If number doesn't start with 1, also search with it
                    searchNumbers = [cleanNumber, `1${cleanNumber}`];
                }

                // Execute queries for all number variants
                const results: Reservation[] = [];
                for (const number of searchNumbers) {
                    const q = query(reservationsRef, where('phone', '==', number));
                    const querySnapshot = await getDocs(q);
                    querySnapshot.forEach((doc) => {
                        // Avoid duplicates by checking if ID already exists
                        if (!results.some(res => res.id === doc.id)) {
                            results.push({ id: doc.id, ...doc.data() } as Reservation);
                        }
                    });
                }
                setReservations(results);
            } else {
                // Regular email search
                const q = query(reservationsRef, where('email', '==', searchValue));
                const querySnapshot = await getDocs(q);
                const results: Reservation[] = [];
                querySnapshot.forEach((doc) => {
                    results.push({ id: doc.id, ...doc.data() } as Reservation);
                });
                setReservations(results);
            }

            setShowResults(true);
        } catch (err) {
            setError('Failed to fetch reservations. Please try again.');
            console.error('Search error:', err);
        } finally {
            setIsSearching(false);
        }
    };

    const handleBack = () => {
        setShowResults(false);
        setReservations([]);
        setSearchValue('');
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 relative animate-fadeIn p-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="h-6 w-6" />
                </button>

                <h2 className="text-2xl font-semibold mb-4">Find My Reservation</h2>

                {!showResults ? (
                    // Search Form
                    <form onSubmit={handleSearch} className="space-y-4">
                        <div className="flex space-x-4 mb-4">
                            <button
                                type="button"
                                onClick={() => setSearchType('email')}
                                className={`px-4 py-2 rounded ${searchType === 'email'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                    }`}
                            >
                                Email
                            </button>
                            <button
                                type="button"
                                onClick={() => setSearchType('phone')}
                                className={`px-4 py-2 rounded ${searchType === 'phone'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700'
                                    }`}
                            >
                                Phone
                            </button>
                        </div>

                        <input
                            type={searchType === 'email' ? 'email' : 'tel'}
                            placeholder={searchType === 'email' ? 'Enter your email' : 'Enter your phone number'}
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="w-full px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />

                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        <button
                            type="submit"
                            disabled={isSearching}
                            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition-colors disabled:bg-indigo-300"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                ) : (
                    // Results View
                    <div className="space-y-4">
                        <button
                            onClick={handleBack}
                            className="text-indigo-600 hover:text-indigo-800 mb-4 flex items-center"
                        >
                            ← Back to Search
                        </button>

                        {reservations.length === 0 ? (
                            <p className="text-center text-gray-500">No reservations found.</p>
                        ) : (
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                {reservations.map((reservation) => (
                                    <div
                                        key={reservation.id}
                                        className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                                    >
                                        <p className="font-semibold">{reservation.name}</p>
                                        <p className="text-sm text-gray-600">
                                            Date: {new Date(reservation.date).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-gray-600">Time: {reservation.time}</p>
                                        <p className="text-sm text-gray-600">
                                            Guests: {reservation.guests}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
