'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

interface User {
  id: string;
  display_name: string;
  username: string;
  email: string;
  user_type: 'admin' | 'photographer' | 'client';
  avatar_url?: string;
  is_verified: boolean;
  created_at: string;
}

interface Analytics {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  photographerCount: number;
  clientCount: number;
  verifiedUsers: number;
}

export default function AdminUsersDashboard() {
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [displayedUsers, setDisplayedUsers] = useState<User[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({
    totalUsers: 0,
    activeUsers: 0,
    adminCount: 0,
    photographerCount: 0,
    clientCount: 0,
    verifiedUsers: 0,
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('client');
  // Initialize Supabase client (uses same env vars as login page)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const calculateActiveUsers = (users: User[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return users.filter(user => {
      if (!user.created_at) return false;
      try {
        const creationDate = new Date(user.created_at);
        return creationDate > thirtyDaysAgo;
      } catch (e) {
        return false;
      }
    }).length;
  };

  const loadUsersAndAnalytics = useCallback(async () => {
    setIsLoading(true);
    
    try {
      // Query profiles table directly via Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const dataUsers: User[] = (data as any) || [];

      // Get current authenticated user id
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || '';
      
      // Filter out current user for display
      const usersForDisplay = dataUsers.filter(user => user.id !== currentUserId);
      
      // Calculate analytics using ALL users
      const newAnalytics: Analytics = {
        totalUsers: dataUsers.length,
        activeUsers: calculateActiveUsers(dataUsers),
        adminCount: dataUsers.filter(u => u.user_type?.toLowerCase() === 'admin').length,
        photographerCount: dataUsers.filter(u => u.user_type?.toLowerCase() === 'photographer').length,
        clientCount: dataUsers.filter(u => !u.user_type || u.user_type?.toLowerCase() === 'client').length,
        verifiedUsers: dataUsers.filter(u => u.is_verified === true).length,
      };
      
      setAllUsers(usersForDisplay);
      setDisplayedUsers(usersForDisplay.slice(0, 10));
      setAnalytics(newAnalytics);
      
    } catch (error: any) {
      console.error('Failed to load users:', error);
      showToast('Failed to load users: ' + (error.message || String(error)), true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsersAndAnalytics();
  }, [loadUsersAndAnalytics]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const searchUsers = (query: string) => {
    if (query.trim() === '') {
      setDisplayedUsers(allUsers.slice(0, 10));
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const searchLower = query.toLowerCase();
      const filtered = allUsers.filter(user => {
        const displayName = (user.display_name || '').toLowerCase();
        const username = (user.username || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const userType = (user.user_type || '').toLowerCase();
        
        return displayName.includes(searchLower) || 
               username.includes(searchLower) || 
               email.includes(searchLower) ||
               userType.includes(searchLower);
      }).slice(0, 10);

      setDisplayedUsers(filtered);
    } catch (error) {
      showToast('Search failed: ' + error, true);
    } finally {
      setIsSearching(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      showToast('Updating user role...', false);
      // Update role directly in Supabase profiles table
      const { error } = await supabase
        .from('profiles')
        .update({ user_type: newRole })
        .eq('id', userId);

      if (error) throw error;

      // Update local state
      const updatedUsers = allUsers.map(user => 
        user.id === userId ? { ...user, user_type: newRole as User['user_type'] } : user
      );
      setAllUsers(updatedUsers);
      
      const updatedDisplayed = displayedUsers.map(user => 
        user.id === userId ? { ...user, user_type: newRole as User['user_type'] } : user
      );
      setDisplayedUsers(updatedDisplayed);

      // Reload analytics
      await loadUsersAndAnalytics();
      
      showToast('User role updated successfully!', false);
      
    } catch (error: any) {
      showToast(error.message || 'Failed to update user role', true);
    }
  };

  const showToast = (message: string, isError: boolean) => {
    // Replace with your preferred toast library
    alert(message);
  };

  const getRoleColor = (userType: string) => {
    switch (userType?.toLowerCase()) {
      case 'admin':
        return 'bg-red-500';
      case 'photographer':
        return 'bg-purple-500';
      default:
        return 'bg-cyan-500';
    }
  };

  const getGradientColors = (userType: string) => {
    switch (userType?.toLowerCase()) {
      case 'admin':
        return 'from-red-600 to-red-500';
      case 'photographer':
        return 'from-purple-600 to-pink-500';
      default:
        return 'from-blue-500 to-cyan-500';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'client':
        return 'Client';
      case 'photographer':
        return 'Photographer';
      case 'admin':
        return 'Admin';
      default:
        return 'Client';
    }
  };

  const formatJoinDate = (dateStr: string) => {
    if (!dateStr) return 'New';
    
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays >= 365) {
        return `${Math.floor(diffDays / 365)}y`;
      } else if (diffDays >= 30) {
        return `${Math.floor(diffDays / 30)}mo`;
      } else if (diffDays > 0) {
        return `${diffDays}d`;
      } else {
        return 'Today';
      }
    } catch (e) {
      return 'New';
    }
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.length > 0 ? name[0].toUpperCase() : 'U';
  };

  const openRoleDialog = (user: User) => {
    setSelectedUser(user);
    setSelectedRole(user.user_type || 'client');
    setIsRoleDialogOpen(true);
  };

  const handleRoleUpdate = () => {
    if (selectedUser && selectedRole !== selectedUser.user_type) {
      updateUserRole(selectedUser.id, selectedRole);
      setIsRoleDialogOpen(false);
    }
  };

  const analyticsCards = [
    { title: 'Total Users', value: analytics.totalUsers, icon: '👥', color: 'bg-blue-500' },
    { title: 'New Users (30d)', value: analytics.activeUsers, icon: '➕', color: 'bg-green-500' },
    { title: 'Admins', value: analytics.adminCount, icon: '🛡️', color: 'bg-red-600' },
    { title: 'Photographers', value: analytics.photographerCount, icon: '📷', color: 'bg-purple-600' },
    { title: 'Clients', value: analytics.clientCount, icon: '👤', color: 'bg-cyan-500' },
    { title: 'Verified', value: analytics.verifiedUsers, icon: '✓', color: 'bg-amber-500' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Users Dashboard
            </h1>
            <button
              onClick={loadUsersAndAnalytics}
              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="flex items-center bg-gray-100 dark:bg-slate-700 rounded-full border border-gray-300 dark:border-slate-600">
              <svg className="w-5 h-5 ml-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users by name, email, or role..."
                className="flex-1 bg-transparent px-4 py-2.5 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 outline-none text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mr-3 p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded-full transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Analytics Section */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                User Analytics
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {analyticsCards.map((card, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-sm"
                  >
                    <div className={`w-10 h-10 ${card.color} bg-opacity-10 rounded-lg flex items-center justify-center mb-2`}>
                      <span className="text-xl">{card.icon}</span>
                    </div>
                    <div className="text-2xl font-extrabold text-gray-900 dark:text-white">
                      {card.value}
                    </div>
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">
                      {card.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Users List Header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {searchQuery ? 'Search Results' : `Other Users (${displayedUsers.length})`}
              </h2>
              {isSearching && (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              )}
            </div>

            {/* Users List */}
            {displayedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                  {searchQuery ? 'No search results' : 'No other users found'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center">
                      {/* Avatar */}
                      <div className="relative">
                        <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${getGradientColors(user.user_type)} flex items-center justify-center overflow-hidden`}>
                          {user.avatar_url ? (
                            <Image
                              src={user.avatar_url}
                              alt={user.username}
                              width={56}
                              height={56}
                              className="object-cover w-full h-full"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-white font-bold text-base">
                              {getInitials(user.display_name || user.username)}
                            </span>
                          )}
                        </div>
                        {user.is_verified && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-600 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* User Info */}
                      <div className="flex-1 ml-4">
                        <div className="font-bold text-base text-gray-900 dark:text-white truncate">
                          {user.username || user.display_name || 'Unknown User'}
                        </div>
                        {user.display_name && user.username !== user.display_name && (
                          <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                            {user.display_name}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            user.user_type?.toLowerCase() === 'admin' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                            user.user_type?.toLowerCase() === 'photographer' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                            'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400'
                          }`}>
                            {getRoleDisplayName(user.user_type)}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatJoinDate(user.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        onClick={() => openRoleDialog(user)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Role Change Dialog */}
      {isRoleDialogOpen && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Change User Role
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-6">
              User: {selectedUser.display_name || selectedUser.username || 'Unknown'}
            </p>
            
            <div className="space-y-3 mb-6">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Select new role:
              </p>
              {['client', 'photographer', 'admin'].map((role) => (
                <label
                  key={role}
                  className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedRole === role
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role}
                    checked={selectedRole === role}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className={`ml-3 font-medium ${
                    selectedRole === role
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    {getRoleDisplayName(role)}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsRoleDialogOpen(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={selectedRole === selectedUser.user_type}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Update Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}