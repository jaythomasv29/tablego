import AdminAuthBoundary from '@/components/AdminAuthBoundary';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthBoundary>{children}</AdminAuthBoundary>;
}
