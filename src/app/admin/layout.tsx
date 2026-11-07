import './admin-console.css';
import './admin-controls.css';
import './admin-glass.css';
import AdminLayout from '@/components/AdminLayout';
import AdminAuthBoundary from '@/components/AdminAuthBoundary';

export const dynamic = 'force-dynamic';
export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthBoundary><AdminLayout>{children}</AdminLayout></AdminAuthBoundary>;
}
