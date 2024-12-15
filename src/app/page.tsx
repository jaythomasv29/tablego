'use client'
import Footer from '@/components/Footer';
import ReservationForm from '../components/ReservationForm';
import { useState } from 'react';
import MenuCard from '@/components/MenuCard';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function Home() {
  const [activeCard, setActiveCard] = useState<'reservation' | 'other'>('reservation');

  return (<>
    <div className="relative flex items-center justify-center min-h-[600px]">
      {/* Left Arrow with Tooltip - Only show when on Menu view */}
      {activeCard === 'other' && (
        <div className="absolute left-[1%] top-1/2 -translate-y-1/2 flex flex-col items-center">
          <Link
            href="/"
            className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors cursor-pointer"
            passHref
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </Link>
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
        <div className="absolute right-[1%] transform -translate-y-1/2 flex flex-col items-center gap-2 z-20">
          <Link
            href="/menu"
            className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors cursor-pointer"
            passHref
          >
            <ArrowRight className="h-6 w-6 text-gray-600" />
          </Link>
          <div className="mt-2 text-sm font-medium text-gray-600 bg-white/80 backdrop-blur-sm px-2 py-1 rounded shadow-sm">
            View Menu
          </div>
        </div>
      )}
    </div>
    <Footer />
  </>
  );
}