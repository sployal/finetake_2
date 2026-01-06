'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import {
  User,
  Mail,
  VerifiedIcon,
  Settings,
  LogOut,
  MoreVertical,
  Grid3x3,
  Bookmark,
  LayoutDashboard,
  Users,
  Edit,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import MyPosts from '@/components/profile/myposts';
import MyBookmarks from '@/components/profile/bookmarks';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url?: string;
}

// Tab Components
function MyPostsTab() {
  return <MyPosts />;
}

function MyBookmarksTab() {
  return <MyBookmarks />;
}

// Main Profile Page Component
export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'posts' | 'bookmarks'>('posts');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, [router]);

  const loadUserProfile = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        setError('Please sign in to view your profile');
        setIsLoading(false);
        router.push('/login');
        return;
      }

      // Fetch user profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setError('Failed to load profile information');
        setIsLoading(false);
        return;
      }

      if (profileData) {
        // Map database fields to UserProfile interface
        setProfile({
          id: profileData.id,
          username: profileData.username || 'user',
          display_name: profileData.full_name || profileData.username || 'User',
          email: currentUser.email || profileData.email || 'No email',
          avatar_url: profileData.avatar_url
        });
        
        // Check admin status
        setIsAdmin(profileData.is_admin || false);
      } else {
        setError('Profile not found');
      }
    } catch (err: any) {
      console.error('Error loading profile:', err);
      setError(`Failed to load profile: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setShowSignOutDialog(false);
      router.push('/login');
    } catch (err: any) {
      console.error('Error signing out:', err);
      setError('Failed to sign out. Please try again.');
    }
  };

  const handleMenuAction = (action: string) => {
    setShowMenu(false);
    switch (action) {
      case 'edit_profile':
        router.push('/profile/edit');
        break;
      case 'dashboard':
        router.push('/dashboard');
        break;
      case 'users':
        router.push('/admin/users');
        break;
      case 'logout':
        setShowSignOutDialog(true);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center p-8">
          <AlertCircle size={64} className="mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">
            Failed to load profile
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={loadUserProfile}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <RefreshCw size={20} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const displayName = profile.display_name || profile.username;
  const showUsername = profile.display_name && profile.display_name !== profile.username;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header Section with Gradient Background */}
      <div className="relative">
        {/* Gradient Background */}
        <div className="h-96 bg-gradient-to-br from-indigo-600 via-purple-600 to-purple-700 relative">
          {/* Menu Button */}
          <div className="absolute top-4 right-4 z-10">
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 text-white hover:bg-white/20 rounded-full transition"
              >
                <MoreVertical size={24} />
              </button>

              {/* Dropdown Menu */}
              {showMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                  />
                  {/* Menu */}
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg overflow-hidden z-30">
                    <button
                      onClick={() => handleMenuAction('edit_profile')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                    >
                      <Edit size={20} className="text-indigo-600" />
                      <span className="font-medium text-gray-900">Edit Profile</span>
                    </button>

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleMenuAction('dashboard')}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                        >
                          <LayoutDashboard size={20} className="text-indigo-600" />
                          <span className="font-medium text-gray-900">Dashboard</span>
                        </button>

                        <button
                          onClick={() => handleMenuAction('users')}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                        >
                          <Users size={20} className="text-indigo-600" />
                          <span className="font-medium text-gray-900">Users</span>
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => handleMenuAction('logout')}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition border-t"
                    >
                      <LogOut size={20} className="text-red-600" />
                      <span className="font-medium text-red-600">Logout</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Profile Content */}
          <div className="container mx-auto px-4 h-full flex flex-col items-center justify-center pt-16 pb-24">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-white shadow-2xl overflow-hidden bg-white">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-400 to-purple-500">
                    <span className="text-5xl font-bold text-white">
                      {profile.username[0]?.toUpperCase() || 'U'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Name & Info */}
            <h1 className="text-3xl font-bold text-white mt-6">{displayName}</h1>
            
            {showUsername && (
              <p className="text-white/80 text-sm font-medium mt-1">
                @{profile.username}
              </p>
            )}

            <p className="text-white/90 text-base mt-2">{profile.email}</p>

            {/* Status Badge */}
            <div className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 rounded-full">
              <VerifiedIcon size={16} className="text-white" />
              <span className="text-white font-medium text-sm">Active Member</span>
            </div>
          </div>
        </div>

        {/* Tabs Section - Overlapping */}
        <div className="relative -mt-12">
          <div className="container mx-auto px-4">
            <div className="bg-white rounded-t-3xl shadow-xl">
              {/* Tab Headers */}
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('posts')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 font-medium transition ${
                    activeTab === 'posts'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Grid3x3 size={20} />
                  My Posts
                </button>
                <button
                  onClick={() => setActiveTab('bookmarks')}
                  className={`flex-1 flex items-center justify-center gap-2 py-4 font-medium transition ${
                    activeTab === 'bookmarks'
                      ? 'text-indigo-600 border-b-2 border-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Bookmark size={20} />
                  Bookmarks
                </button>
              </div>

              {/* Tab Content */}
              <div className="min-h-[400px]">
                {activeTab === 'posts' ? <MyPostsTab /> : <MyBookmarksTab />}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Dialog */}
      {showSignOutDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Sign Out</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to sign out?</p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSignOutDialog(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}