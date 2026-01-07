'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Supabase client for the client component
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface TopAppBarProps {
  onRefresh: () => void;
}

export default function TopAppBar({ onRefresh }: TopAppBarProps) {
  const router = useRouter();
  
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [messagesChannel, setMessagesChannel] = useState<RealtimeChannel | null>(null);
  const [notificationsChannel, setNotificationsChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    loadUnreadCounts();
    subscribeToMessages();
    subscribeToNotifications();

    return () => {
      messagesChannel?.unsubscribe();
      notificationsChannel?.unsubscribe();
    };
  }, []);

  const loadUnreadCounts = async () => {
    await Promise.all([
      loadUnreadMessagesCount(),
      loadUnreadNotificationsCount(),
    ]);
  };

  const loadUnreadMessagesCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setUnreadMessagesCount(data?.length || 0);
    } catch (error) {
      console.error('Error loading unread messages count:', error);
    }
  };

  const loadUnreadNotificationsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all notifications
      const { data: notifications, error: notifError } = await supabase
        .from('notifications')
        .select('id');

      if (notifError) throw notifError;

      const notificationIds =
        notifications?.map((item: { id: string }) => item.id) || [];

      if (notificationIds.length === 0) {
        setUnreadNotificationsCount(0);
        return;
      }

      // Get notifications that user has read
      const { data: readNotifications, error: readError } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id)
        .in('notification_id', notificationIds);

      if (readError) throw readError;

      const readNotificationIds = new Set(
        readNotifications?.map((item: { notification_id: string }) => item.notification_id) || []
      );

      // Calculate unread count
      const unreadCount = notificationIds.length - readNotificationIds.size;
      setUnreadNotificationsCount(unreadCount);
    } catch (error) {
      console.error('Error loading unread notifications count:', error);
    }
  };

  const subscribeToMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase
      .channel(`unread_messages_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          loadUnreadMessagesCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          loadUnreadMessagesCount();
        }
      )
      .subscribe();

    setMessagesChannel(channel);
  };

  const subscribeToNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const channel = supabase
      .channel(`notifications_changes_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadUnreadNotificationsCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadUnreadNotificationsCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_reads',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadUnreadNotificationsCount();
        }
      )
      .subscribe();

    setNotificationsChannel(channel);
  };

  const handleMessagesClick = () => {
    router.push('/messages');
    // Reload count when returning (you can handle this with a focus event or router event)
  };

  const handleNotificationsClick = () => {
    router.push('/notifications');
    // Reload count when returning
  };

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 shadow-lg">
      <div className="flex items-center justify-between px-4 py-3">
        {/* Logo Section */}
        <div className="flex items-center gap-3">
          <svg 
            className="w-7 h-7 text-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
            />
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
            />
          </svg>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            home
          </h1>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Refresh"
          >
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
          </button>

          {/* Messages Button with Badge */}
          <button
            onClick={handleMessagesClick}
            className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Messages"
          >
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" 
              />
            </svg>
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] min-h-[18px] px-1 bg-pink-500 text-white text-[10px] font-bold rounded-full border-2 border-white">
                {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Notifications Button with Badge */}
          <button
            onClick={handleNotificationsClick}
            className="relative p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Notifications"
          >
            <svg 
              className="w-6 h-6 text-white" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
              />
            </svg>
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] min-h-[18px] px-1 bg-pink-500 text-white text-[10px] font-bold rounded-full border-2 border-white">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}