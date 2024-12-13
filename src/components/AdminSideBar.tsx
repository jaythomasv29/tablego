import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminSidebar() {
    const pathname = usePathname();

    const isActiveLink = (path: string) => {
        return pathname === path ? "bg-gray-700" : "";
    };

    return (
        <div className="w-64 bg-gray-800 text-white p-6 min-h-screen">
            <h2 className="text-xl font-bold mb-6">Admin Dashboard</h2>
            <nav>
                <ul className="space-y-2">
                    <li>
                        <Link
                            href="/admin/home"
                            className={`block py-2 px-4 rounded hover:bg-gray-700 transition-colors ${isActiveLink('/admin/home')}`}
                        >
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/admin/hours"
                            className={`block py-2 px-4 rounded hover:bg-gray-700 transition-colors ${isActiveLink('/admin/hours')}`}
                        >
                            Business Hours
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/admin/reservation"
                            className={`block py-2 px-4 rounded hover:bg-gray-700 transition-colors ${isActiveLink('/admin/reservation')}`}
                        >
                            Reservations
                        </Link>
                    </li>
                    {/* Add more navigation items as needed */}
                </ul>
            </nav>
        </div>
    );
}