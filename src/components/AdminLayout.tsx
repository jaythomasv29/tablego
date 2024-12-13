import AdminSidebar from './AdminSideBar';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    return (
        <div className="flex h-screen">
            <AdminSidebar />
            <div className="flex-1 p-8 bg-gray-50 overflow-auto">
                {children}
            </div>
        </div>
    );
}