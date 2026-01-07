'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Profile {
  id: string;
  display_name: string | null;
  username: string | null;
  email: string | null;
  user_type: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_display_name: string | null;
  user2_display_name: string | null;
  user1_username: string | null;
  user2_username: string | null;
  user1_avatar_url: string | null;
  user2_avatar_url: string | null;
  user1_unread_count: number;
  user2_unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MessagesScreen() {
  const router = useRouter();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<Profile[]>([]);
  const [hasUserSearchQuery, setHasUserSearchQuery] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Load current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Load conversations
  const loadConversations = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('conversations_with_details')
        .select('*')
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      setConversations(data || []);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading conversations:', error);
      setIsLoading(false);
    }
  }, []);

  // Subscribe to realtime messages
  useEffect(() => {
    loadConversations();

    channelRef.current = supabase
      .channel('messages_channel')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, () => {
        loadConversations();
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [loadConversations]);

  // Search users
  const searchUsers = async (query: string) => {
    if (query.trim() === '') {
      setUserSearchResults([]);
      setHasUserSearchQuery(false);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    setHasUserSearchQuery(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const searchQuery = query.toLowerCase();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, email, user_type, avatar_url, is_verified')
        .neq('id', user.id)
        .or(`display_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
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
  };

  // Debounced search
  const performSearch = (query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      searchUsers(query);
    }, 300);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    performSearch(value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setUserSearchResults([]);
    setHasUserSearchQuery(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // Start conversation
  const startConversation = async (user: Profile) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const userId1 = currentUser.id < user.id ? currentUser.id : user.id;
      const userId2 = currentUser.id < user.id ? user.id : currentUser.id;

      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('user1_id', userId1)
        .eq('user2_id', userId2)
        .maybeSingle();

      clearSearch();

      router.push(`/messages/${existingConversation?.id || 'new'}?userId=${user.id}&userName=${user.display_name || user.username || 'Unknown User'}&avatar=${user.avatar_url || ''}`);
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  // Delete conversation
  const deleteConversation = async () => {
    if (!selectedConversationId) return;

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', selectedConversationId);

      await supabase
        .from('conversations')
        .delete()
        .eq('id', selectedConversationId);

      setIsSelectionMode(false);
      setSelectedConversationId(null);
      loadConversations();
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  };

  // Get other user info
  const getOtherUserInfo = (conversation: Conversation) => {
    const isUser1 = conversation.user1_id === currentUserId;
    
    return {
      id: isUser1 ? conversation.user2_id : conversation.user1_id,
      display_name: isUser1 ? conversation.user2_display_name : conversation.user1_display_name,
      avatar_url: isUser1 ? conversation.user2_avatar_url : conversation.user1_avatar_url,
      username: isUser1 ? conversation.user2_username : conversation.user1_username,
    };
  };

  // Get unread count
  const getUnreadCount = (conversation: Conversation) => {
    const isUser1 = conversation.user1_id === currentUserId;
    return isUser1 ? conversation.user1_unread_count : conversation.user2_unread_count;
  };

  // Format time
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const difference = now.getTime() - date.getTime();
    const minutes = Math.floor(difference / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;

    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    if (date >= todayStart) {
      let hour = date.getHours();
      const adjustedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const minute = date.getMinutes().toString().padStart(2, '0');
      const period = hour >= 12 ? 'PM' : 'AM';
      return `${adjustedHour}:${minute} ${period}`;
    }

    if (date >= yesterdayStart) return 'Yesterday';

    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().substring(2);
    return `${month}/${day}/${year}`;
  };

  // Get initials
  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    const words = name.trim().split(' ');
    if (words.length >= 2) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  // Get role color
  const getRoleColor = (role: string | null) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-pink-500';
      case 'photographer':
        return 'bg-purple-500';
      default:
        return 'bg-blue-500';
    }
  };

  // Get role display name
  const getRoleDisplayName = (role: string | null) => {
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

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            {isSelectionMode ? (
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedConversationId(null);
                }}
                className="text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <button onClick={() => router.back()} className="text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-xl font-bold text-white">
              {isSelectionMode ? '1 selected' : 'Messages'}
            </h1>
          </div>
          {isSelectionMode && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
                  deleteConversation();
                }
              }}
              className="text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 bg-white border-b">
        <div className="relative">
          <div className="flex items-center bg-gray-100 rounded-lg px-4 py-3">
            <svg className="w-5 h-5 text-gray-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search users to message..."
              className="flex-1 bg-transparent text-black text-[15px] outline-none placeholder-gray-600"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="ml-2">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
        {!hasUserSearchQuery || !searchQuery ? (
          <>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-4">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
                  <svg className="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No messages yet</h3>
                <p className="text-sm text-gray-500">Search for someone to start chatting!</p>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                {conversations.map((conversation) => {
                  const otherUser = getOtherUserInfo(conversation);
                  const unreadCount = getUnreadCount(conversation);
                  const isSelected = selectedConversationId === conversation.id;

                  return (
                    <div
                      key={conversation.id}
                      className={`border-b border-gray-200 ${isSelected ? 'bg-blue-50' : 'bg-white'}`}
                    >
                      <div
                        className="flex items-center px-4 py-4 cursor-pointer hover:bg-gray-50"
                        onClick={() => {
                          if (isSelectionMode) {
                            setIsSelectionMode(false);
                            setSelectedConversationId(null);
                          } else {
                            router.push(`/messages/${conversation.id}?userId=${otherUser.id}&userName=${otherUser.display_name || 'Unknown User'}&avatar=${otherUser.avatar_url || ''}`);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setIsSelectionMode(true);
                          setSelectedConversationId(conversation.id);
                        }}
                      >
                        <div className="relative mr-3">
                          <div className={`w-14 h-14 rounded-full ${otherUser.avatar_url ? '' : 'bg-blue-100'} flex items-center justify-center overflow-hidden`}>
                            {otherUser.avatar_url ? (
                              <img src={otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-blue-500 font-semibold text-xl">
                                {(otherUser.display_name || 'U')[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className={`text-base ${unreadCount > 0 ? 'font-bold' : 'font-semibold'} text-gray-900 truncate`}>
                              {otherUser.display_name || 'Unknown User'}
                            </h3>
                            <span className={`text-[13px] ${unreadCount > 0 ? 'text-blue-500 font-semibold' : 'text-gray-600'} ml-2 flex-shrink-0`}>
                              {formatTime(conversation.last_message_at)}
                            </span>
                          </div>
                          <div className="flex items-center">
                            <p className={`text-sm ${unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-600'} truncate flex-1`}>
                              {conversation.last_message || 'No messages yet'}
                            </p>
                            {unreadCount > 0 && (
                              <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-[11px] font-bold rounded-full flex-shrink-0 min-w-[20px] text-center">
                                {unreadCount > 99 ? '99+' : unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="h-full bg-white overflow-hidden flex flex-col">
            <div className="px-4 py-4 bg-gray-50 border-b border-gray-200 flex items-center">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <span className="text-base font-semibold text-gray-900">Start a conversation</span>
              {isSearchingUsers && (
                <div className="ml-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {isSearchingUsers ? (
                <div className="flex items-center justify-center h-full">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full px-4">
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center mb-6">
                    <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No users found</h3>
                  <p className="text-sm text-gray-500">Try searching with different keywords</p>
                </div>
              ) : (
                userSearchResults.map((user) => (
                  <div key={user.id} className="border-b border-gray-200 bg-white">
                    <div
                      className="flex items-center px-4 py-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => startConversation(user)}
                    >
                      <div className="relative mr-3">
                        <div className={`w-14 h-14 rounded-full ${user.avatar_url ? '' : getRoleColor(user.user_type).replace('bg-', 'bg-') + '/15'} flex items-center justify-center overflow-hidden`}>
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className={`${getRoleColor(user.user_type).replace('bg-', 'text-')} font-bold text-base`}>
                              {getInitials(user.display_name || user.username)}
                            </span>
                          )}
                        </div>
                        {user.is_verified && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-gray-900 truncate">
                            {user.display_name || user.username || 'Unknown User'}
                          </h3>
                          <span className={`px-2 py-0.5 ${getRoleColor(user.user_type)}/10 border ${getRoleColor(user.user_type)}/30 ${getRoleColor(user.user_type).replace('bg-', 'text-')} text-[10px] font-semibold rounded-lg flex-shrink-0`}>
                            {getRoleDisplayName(user.user_type)}
                          </span>
                        </div>
                        {user.username && user.username !== user.display_name && (
                          <p className="text-sm text-gray-600 font-medium mb-0.5">
                            @{user.username}
                          </p>
                        )}
                        {user.email && (
                          <p className="text-[13px] text-gray-500 truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}