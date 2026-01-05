'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface UserSearchResult {
  id: string;
  display_name?: string;
  username?: string;
  email?: string;
  user_type?: string;
  avatar_url?: string;
  is_verified?: boolean;
}

interface SearchPageProps {
  initialTab?: 'explore' | 'tags';
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SearchPage({ initialTab = 'explore' }: SearchPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'explore' | 'tags'>(initialTab);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [hasUserSearchQuery, setHasUserSearchQuery] = useState(false);
  
  const router = useRouter();

  // Debounced user search
  const searchUsers = useCallback(async (query: string) => {
    if (query.trim().length === 0) {
      setUserSearchResults([]);
      setHasUserSearchQuery(false);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    setHasUserSearchQuery(true);

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const searchTerm = query.toLowerCase();

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, email, user_type, avatar_url, is_verified')
        .neq('id', currentUser?.id || '')
        .or(`display_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('display_name', { ascending: true })
        .limit(20);

      if (error) throw error;

      setUserSearchResults(data || []);
    } catch (error) {
      console.error('Failed to search users:', error);
      setUserSearchResults([]);
    } finally {
      setIsSearchingUsers(false);
    }
  }, [supabase]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setUserSearchResults([]);
        setHasUserSearchQuery(false);
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);


  const navigateToProfile = (user: UserSearchResult) => {
    router.push(`/profile/${user.id}`);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setUserSearchResults([]);
    setHasUserSearchQuery(false);
  };

  const handleTabChange = (tab: 'explore' | 'tags') => {
    setActiveTab(tab);
    if (tab !== 'explore') {
      handleClearSearch();
    }
  };

  const getSearchHint = () => {
    switch (activeTab) {
      case 'explore':
        return 'Search posts, photographers, users...';
      case 'tags':
        return 'Search users...';
      default:
        return 'Search...';
    }
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name.length > 0 ? name[0].toUpperCase() : 'U';
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-600 border-red-300';
      case 'photographer':
        return 'bg-purple-100 text-purple-600 border-purple-300';
      default:
        return 'bg-cyan-100 text-cyan-600 border-cyan-300';
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
        return role || 'Client';
    }
  };

  const getAvatarBgColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-red-50';
      case 'photographer':
        return 'bg-purple-50';
      default:
        return 'bg-cyan-50';
    }
  };

  const getAvatarTextColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'text-red-600';
      case 'photographer':
        return 'text-purple-600';
      default:
        return 'text-cyan-600';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header with Search Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="p-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getSearchHint()}
              className="w-full h-10 pl-10 pr-10 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 dark:text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => handleTabChange('explore')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'explore'
                ? 'text-blue-500'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Explore
            {activeTab === 'explore' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
          <button
            onClick={() => handleTabChange('tags')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
              activeTab === 'tags'
                ? 'text-blue-500'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Tags
            {activeTab === 'tags' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="relative">
        {/* User Search Overlay */}
        {hasUserSearchQuery && searchQuery && (
          <div className="absolute inset-0 z-20 bg-slate-50 dark:bg-slate-900">
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Users</h2>
                {isSearchingUsers && (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* User Search Results */}
              <div className="space-y-3">
                {isSearchingUsers && userSearchResults.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : userSearchResults.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
                      No users found
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Try searching with different keywords
                    </p>
                  </div>
                ) : (
                  userSearchResults.map((user) => (
                    <div
                      key={user.id}
                      onClick={() => navigateToProfile(user)}
                      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div className={`w-14 h-14 rounded-full overflow-hidden ${
                            user.avatar_url ? '' : `${getAvatarBgColor(user.user_type || 'client')} flex items-center justify-center`
                          }`}>
                            {user.avatar_url ? (
                              <Image
                                src={user.avatar_url}
                                alt={user.display_name || user.username || 'User'}
                                width={56}
                                height={56}
                                className="object-cover"
                              />
                            ) : (
                              <span className={`text-lg font-bold ${getAvatarTextColor(user.user_type || 'client')}`}>
                                {getInitials(user.display_name || user.username || 'U')}
                              </span>
                            )}
                          </div>
                          {user.is_verified && (
                            <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 rounded-full p-0.5">
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                              {user.display_name || user.username || 'Unknown User'}
                            </h3>
                            <span className={`px-2 py-1 rounded-lg text-xs font-semibold border ${getRoleColor(user.user_type || 'client')}`}>
                              {getRoleDisplayName(user.user_type || 'client')}
                            </span>
                          </div>
                          {user.username && user.username !== user.display_name && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                              @{user.username}
                            </p>
                          )}
                          {user.email && (
                            <p className="text-xs text-slate-500 dark:text-slate-500 truncate">
                              {user.email}
                            </p>
                          )}
                        </div>

                        {/* Chevron */}
                        <svg className="w-5 h-5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content (when not showing user search) */}
        {(!hasUserSearchQuery || !searchQuery) && (
          <div>
            {activeTab === 'explore' && (
              <div className="p-4">
                {/* Explore content - you can import your ExplorePage component here */}
                <p className="text-center text-slate-500 dark:text-slate-400">
                  Explore content goes here
                </p>
              </div>
            )}
            {activeTab === 'tags' && (
              <div className="p-4">
                {/* Tags content */}
                <p className="text-center text-slate-500 dark:text-slate-400">
                  Tags content goes here
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}