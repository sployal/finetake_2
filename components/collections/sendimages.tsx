'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

interface User {
  id: string;
  display_name?: string;
  username?: string;
  email?: string;
  user_type?: string;
  avatar_url?: string;
  is_verified?: boolean;
}

interface SelectedImage {
  file: File;
  preview: string;
}

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function SendImages() {
  
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [requirePayment, setRequirePayment] = useState(true);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; isError: boolean } | null>(null);

  // Load users on mount
  useEffect(() => {
    loadUsers();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, email, user_type, avatar_url, is_verified')
        .neq('id', currentUser?.id || '')
        .order('display_name', { ascending: true });

      if (error) throw error;

      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      showSnackBar(`Failed to load users: ${error}`, true);
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = (query: string) => {
    if (!query.trim()) {
      setFilteredUsers(users);
      return;
    }

    const searchLower = query.toLowerCase();
    const filtered = users.filter(user => {
      const displayName = (user.display_name || '').toLowerCase();
      const username = (user.username || '').toLowerCase();
      const email = (user.email || '').toLowerCase();

      return displayName.includes(searchLower) ||
             username.includes(searchLower) ||
             email.includes(searchLower);
    });

    setFilteredUsers(filtered);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const currentCount = selectedImages.length;
    const availableSlots = 10 - currentCount;

    if (availableSlots <= 0) {
      showSnackBar('You already have the maximum of 10 images selected', true);
      return;
    }

    const newImages: SelectedImage[] = [];
    const filesToAdd = Math.min(files.length, availableSlots);

    for (let i = 0; i < filesToAdd; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        newImages.push({
          file,
          preview: URL.createObjectURL(file)
        });
      }
    }

    setSelectedImages(prev => [...prev, ...newImages]);

    if (files.length > availableSlots) {
      showSnackBar(`Added ${filesToAdd} images. ${files.length - availableSlots} images were skipped (max 10 allowed)`, true);
    } else {
      showSnackBar(`Added ${filesToAdd} image${filesToAdd === 1 ? '' : 's'}`);
    }

    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
    showSnackBar('Image removed');
  };

  const clearAllImages = () => {
    selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setSelectedImages([]);
    showSnackBar('All images cleared');
  };

  const sendImages = async () => {
    if (!selectedUser || selectedImages.length === 0) return;

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        showSnackBar('Please log in again', true);
        return;
      }

      const formData = new FormData();
      formData.append('recipient_id', selectedUser.id);
      
      if (title.trim()) formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      formData.append('is_payment_required', requirePayment.toString());

      selectedImages.forEach(img => {
        formData.append('images', img.file);
      });

      const response = await fetch('https://fine-back2.onrender.com/api/images/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        showSnackBar(result.message || 'Images sent successfully!');
        
        // Reset state
        selectedImages.forEach(img => URL.revokeObjectURL(img.preview));
        setSelectedImages([]);
        setSelectedUser(null);
        setSearchQuery('');
        setTitle('');
        setDescription('');
        setFilteredUsers(users);
        setRequirePayment(true);
        setShowDetailsDialog(false);
      } else {
        showSnackBar(result.error || 'Failed to send images', true);
      }
    } catch (error) {
      showSnackBar(`Failed to send images: ${error}`, true);
    } finally {
      setIsSending(false);
    }
  };

  const showSnackBar = (message: string, isError = false) => {
    setSnackbar({ message, isError });
    setTimeout(() => setSnackbar(null), isError ? 4000 : 2000);
  };

  const getInitials = (name: string) => {
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name ? name[0].toUpperCase() : 'U';
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin': return 'text-red-600 bg-red-50';
      case 'photographer': return 'text-purple-600 bg-purple-50';
      default: return 'text-cyan-600 bg-cyan-50';
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap: Record<string, string> = {
      client: 'Client',
      photographer: 'Photographer',
      admin: 'Admin'
    };
    return roleMap[role?.toLowerCase()] || role;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 to-blue-400 dark:from-blue-600 dark:to-slate-900 rounded-b-3xl shadow-lg">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 dark:bg-white/5 rounded-full p-2.5">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white tracking-wide drop-shadow-sm">
                Send Images
              </h1>
              <p className="text-white/85 text-sm font-medium mt-1">
                Select a user and share your photo collections
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Selected User Banner */}
      {selectedUser && (
        <div className="mx-4 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
              {selectedUser.avatar_url ? (
                <img src={selectedUser.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                getInitials(selectedUser.display_name || selectedUser.username || 'U')
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-600 dark:text-gray-400">Sending to:</p>
              <p className="text-base font-semibold text-blue-600 dark:text-blue-400 truncate">
                {selectedUser.display_name || selectedUser.username || 'Unknown'}
              </p>
            </div>
            <button
              onClick={() => setSelectedUser(null)}
              className="p-1.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
            >
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-24">
        {!selectedUser ? (
          // User Selection
          <div>
            <div className="bg-white dark:bg-slate-800 p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Find Users
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Search by name, username, or email to send photo collections
              </p>

              {/* Search Bar */}
              <div className={`h-12 bg-gray-50 dark:bg-slate-700 rounded-3xl border-2 transition-all ${
                searchQuery ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-gray-200 dark:border-slate-600'
              }`}>
                <div className="flex items-center h-full px-4">
                  <svg className={`w-5 h-5 ${searchQuery ? 'text-blue-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users to send images to..."
                    className="flex-1 px-3 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500 text-sm font-medium"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-1 rounded-full bg-gray-200 dark:bg-slate-600 hover:bg-gray-300 dark:hover:bg-slate-500"
                    >
                      <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results Indicator */}
              {searchQuery && (
                <div className="flex items-center justify-between mt-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                    <span className="text-sm font-semibold text-blue-600">
                      {filteredUsers.length} result{filteredUsers.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </span>
                  </div>
                  {filteredUsers.length > 0 && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="h-px bg-gray-200 dark:bg-slate-700" />

            {/* User List */}
            <div className="p-4 space-y-2">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {searchQuery ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    )}
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    {searchQuery ? 'No search results' : 'No users found'}
                  </h3>
                  {searchQuery && (
                    <p className="text-sm text-gray-500">Try searching with different keywords</p>
                  )}
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 hover:border-blue-500 dark:hover:border-blue-600 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-semibold overflow-hidden flex-shrink-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(user.display_name || user.username || 'U')
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">
                          {user.display_name || user.username || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                          {user.email || ''}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getRoleColor(user.user_type || 'client')}`}>
                        {getRoleDisplayName(user.user_type || 'client')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          // Image Selection
          <div className="p-4 space-y-4">
            {/* Action Buttons */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white py-3 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-medium">Gallery</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={selectedImages.length >= 10}
                  />
                </label>

                <label className="flex items-center justify-center gap-2 bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white py-3 rounded-xl cursor-pointer hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="font-medium">Camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageSelect}
                    className="hidden"
                    disabled={selectedImages.length >= 10}
                  />
                </label>
              </div>
            </div>

            {/* Image Count */}
            {selectedImages.length > 0 && (
              <div className="inline-flex items-center px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full">
                <span className="text-sm font-semibold text-blue-600">
                  {selectedImages.length}/10 images selected
                </span>
              </div>
            )}

            {/* Images Grid */}
            {selectedImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">
                  Select images to send
                </h3>
                <p className="text-sm text-gray-500">
                  Choose from Gallery or Camera
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {selectedImages.map((img, index) => (
                  <div key={index} className="relative aspect-square rounded-xl overflow-hidden shadow-md group">
                    <img
                      src={img.preview}
                      alt={`Selected ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-1 left-1 bg-black/70 text-white text-xs font-semibold px-2 py-0.5 rounded-lg">
                      {index + 1}
                    </div>
                    <button
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 rounded-full transition-colors"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      {selectedUser && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 md:left-64 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 p-4 shadow-lg z-40">
          <div className="flex gap-3 md:max-w-7xl md:mx-auto">
            {selectedImages.length > 0 && (
              <button
                onClick={clearAllImages}
                className="flex items-center justify-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="font-medium">Clear All</span>
              </button>
            )}
            <button
              onClick={() => setShowDetailsDialog(true)}
              disabled={selectedImages.length === 0 || isSending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white py-3 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Send {selectedImages.length} Image{selectedImages.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Details Dialog */}
      {showDetailsDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Collection Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title (Optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Wedding Photos, Event Coverage"
                  maxLength={255}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add details about the photo collection"
                  maxLength={500}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Require Payment</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Recipients must pay to view images</p>
                </div>
                <button
                  onClick={() => setRequirePayment(!requirePayment)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    requirePayment ? 'bg-blue-500' : 'bg-gray-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      requirePayment ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendImages}
                disabled={isSending}
                className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-slate-700 text-white rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send Images'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar Notification */}
      {snackbar && (
        <div className="fixed bottom-32 md:bottom-24 left-4 right-4 md:left-[calc(16rem+1rem)] md:right-4 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-lg shadow-lg ${
            snackbar.isError 
              ? 'bg-red-600 text-white' 
              : 'bg-green-600 text-white'
          }`}>
            <p className="text-sm font-medium">{snackbar.message}</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}