'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './sidebar';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render sidebar until component is mounted and pathname is determined
  // Hide sidebar on login page and root page (which redirects to login)
  const showSidebar = mounted && pathname && pathname !== '/login' && pathname !== '/';

  return (
    <div className="flex min-h-screen">
      {showSidebar && <Sidebar />}
      <div className={`flex-1 ${showSidebar ? 'pb-16 md:pb-0' : ''}`}>
        {children}
      </div>
    </div>
  );
}

