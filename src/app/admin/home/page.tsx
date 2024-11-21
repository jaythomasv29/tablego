'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminHome() {
    const router = useRouter();

    return (
        <div className="flex h-screen">
            {/* Sidebar */}
            <div className="w-64 bg-gray-800 text-white p-6">
                <h2 className="text-xl font-bold mb-6">Admin Dashboard</h2>
                <nav>
                    <ul className="space-y-2">
                        <li>
                            <Link
                                href="/admin/home"
                                className="block py-2 px-4 rounded hover:bg-gray-700"
                            >
                                Dashboard
                            </Link>
                        </li>
                        <li>
                            <Link
                                href="/admin/hours"
                                className="block py-2 px-4 rounded hover:bg-gray-700"
                            >
                                Business Hours
                            </Link>
                            <Link
                                href="/admin/reservation"
                                className="block py-2 px-4 rounded hover:bg-gray-700"
                            >
                                Reservations
                            </Link>
                        </li>
                        {/* Add more admin navigation items as needed */}
                    </ul>
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-8">
                <h1 className="text-2xl font-bold mb-6">Welcome to Admin Dashboard</h1>
                {/* Add your dashboard content here */}
            </div>
        </div>
    );
}