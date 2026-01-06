'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = pathname !== '/login';

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className={`flex-1 ${showSidebar ? 'ml-64' : ''}`}>
        {children}
      </div>
    </div>
  );
}

