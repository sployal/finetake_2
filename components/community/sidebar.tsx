'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Home, Search, PlusSquare, FolderOpen, User } from 'lucide-react';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    {
      label: 'Home',
      icon: Home,
      path: '/community',
    },
    {
      label: 'Explore',
      icon: Search,
      path: '/search',
    },
    {
      label: 'Post',
      icon: PlusSquare,
      path: '/post',
    },
    {
      label: 'Collection',
      icon: FolderOpen,
      path: '/collections',
    },
    {
      label: 'Profile',
      icon: User,
      path: '/profile',
    },
  ];

  const isActive = (path: string) => {
    return pathname === path;
  };

  // Hide sidebar on login page
  if (pathname === '/login') {
    return null;
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white shadow-lg h-screen sticky top-0 flex-col flex-shrink-0">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-blue-600">FineTake</h2>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <li key={item.path}>
                  <button
                    onClick={() => router.push(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-blue-50 text-blue-600 font-semibold'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                    <span className="text-sm">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Mobile Bottom App Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 rounded-t-xl">
        <div className="flex justify-around items-center h-16 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="flex flex-col items-center justify-center relative flex-1 h-full transition-colors"
              >
                <Icon className={`w-6 h-6 ${active ? 'text-blue-600' : 'text-gray-600'}`} />
                {active && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></div>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

