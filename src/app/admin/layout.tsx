import AdminAuthBoundary from '@/components/AdminAuthBoundary';

export const dynamic = 'force-dynamic';
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthBoundary>{children}</AdminAuthBoundary>;
}
