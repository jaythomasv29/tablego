'use client'
import Footer from '@/components/Footer';
import ReservationForm from '../components/ReservationForm';
import { useState } from 'react';
import MenuCard from '@/components/MenuCard';

export default function Home() {
  const [activeCard, setActiveCard] = useState<'reservation' | 'other'>('reservation');

  return (<>
    <div className="relative flex items-center justify-center min-h-[600px]">
      {/* Left Arrow with Tooltip - Only show when on Menu view */}
      {activeCard === 'other' && (
        <div className="absolute left-[1%] top-1/2 -translate-y-1/2 flex flex-col items-center">
          <button
            onClick={() => setActiveCard('reservation')}
            className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
            aria-label="Previous card"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="mt-2 bg-gray-800/40 text-white text-sm px-2 py-1 rounded whitespace-nowrap">
            Reservations
          </div>
        </div>
      )}

      {/* Cards */}
      <div className="w-full">
        {activeCard === 'reservation' ? (
          <ReservationForm />
        ) : (
          <MenuCard />
        )}
      </div>

      {/* Right Arrow with Tooltip - Only show when on Reservation view */}
      {activeCard === 'reservation' && (
        <div className="absolute right-[1%] top-1/2 -translate-y-1/2 flex flex-col items-center">
          <button
            onClick={() => setActiveCard('other')}
            className="bg-white p-2 rounded-full shadow-lg hover:bg-gray-100"
            aria-label="Next card"
          >
            <svg
              className="w-6 h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
          <div className="mt-2 bg-gray-800/40 text-white text-sm px-2 py-1 rounded whitespace-nowrap">
            View Menu
          </div>
        </div>
      )}
    </div>
    <Footer />
  </>
  );
}