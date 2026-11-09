import './admin-console.css';
import './admin-controls.css';
import './admin-glass.css';
import InventoryQuickReviewProvider from '@/components/inventory/InventoryQuickReviewProvider';
import AdminLayout from '@/components/AdminLayout';
import AdminAuthBoundary from '@/components/AdminAuthBoundary';

export const dynamic = 'force-dynamic';
export default function AdminRouteLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthBoundary><InventoryQuickReviewProvider><AdminLayout>{children}</AdminLayout></InventoryQuickReviewProvider></AdminAuthBoundary>;
}
