'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface NotificationItem {
  id: string;
  message: string;
  created_at: string;
  created_by: string;
  isRead: boolean;
}

export default function NotificationsPage() {
  const router = useRouter();
  
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [messageController, setMessageController] = useState('');
  const [editingNotificationId, setEditingNotificationId] = useState<string | null>(null);
  const [editControllers, setEditControllers] = useState<Record<string, string>>({});
  const [showFab, setShowFab] = useState(false);
  const [snackbar, setSnackbar] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initializeScreen();
    
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  const initializeScreen = async () => {
    await checkAdminStatus();
    await loadNotifications();
    await markAllAsRead();
    setupRealtimeSubscription();
  };

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', user.id)
        .single();

      const adminStatus = profile?.user_type === 'admin';
      setIsAdmin(adminStatus);
      
      if (adminStatus) {
        setTimeout(() => setShowFab(true), 100);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: notificationsData, error: notifError } = await supabase
        .from('notifications')
        .select(`
          id,
          message,
          created_at,
          created_by,
          notification_reads!left(user_id)
        `)
        .order('created_at', { ascending: false });

      if (notifError) throw notifError;

      const processedNotifications: NotificationItem[] = (notificationsData || []).map(
        (item: any) => {
          const reads = item.notification_reads as any[] | null;
          const isRead = reads?.some((read: any) => read.user_id === user.id) ?? false;

          return {
            id: item.id,
            message: item.message,
            created_at: item.created_at,
            created_by: item.created_by,
            isRead,
          };
        }
      );

      setNotifications(processedNotifications);
      
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      showSnackBar(`Failed to load notifications: ${error}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const unreadNotifications = notifications.filter(n => !n.isRead);
      
      if (unreadNotifications.length === 0) return;

      const reads = unreadNotifications.map(notification => ({
        notification_id: notification.id,
        user_id: user.id,
      }));

      await supabase
        .from('notification_reads')
        .upsert(reads, { onConflict: 'notification_id,user_id' });

      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const setupRealtimeSubscription = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    channelRef.current = supabase
      .channel(`notifications_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        async () => {
          await loadNotifications();
          await markAllAsRead();
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
        async () => {
          await loadNotifications();
        }
      )
      .subscribe();
  };

  const sendNotification = async () => {
    if (messageController.trim() === '') {
      showSnackBar('Please enter a message', 'error');
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('notifications')
        .insert({
          message: messageController.trim(),
          created_by: user.id,
        });

      if (error) throw error;

      setMessageController('');
      showSnackBar('Notification sent successfully!', 'success');
    } catch (error) {
      showSnackBar(`Failed to send notification: ${error}`, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      showSnackBar('Notification deleted', 'success');
    } catch (error) {
      showSnackBar(`Failed to delete notification: ${error}`, 'error');
    }
  };

  const startEditingNotification = (notificationId: string, currentMessage: string) => {
    setEditingNotificationId(notificationId);
    setEditControllers(prev => ({ ...prev, [notificationId]: currentMessage }));
  };

  const cancelEditingNotification = (notificationId: string) => {
    setEditingNotificationId(null);
    setEditControllers(prev => {
      const updated = { ...prev };
      delete updated[notificationId];
      return updated;
    });
  };

  const saveEditedNotification = async (notificationId: string) => {
    const newMessage = editControllers[notificationId]?.trim();
    
    if (!newMessage) {
      showSnackBar('Message cannot be empty', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ message: newMessage })
        .eq('id', notificationId);

      if (error) throw error;

      setEditingNotificationId(null);
      setEditControllers(prev => {
        const updated = { ...prev };
        delete updated[notificationId];
        return updated;
      });

      showSnackBar('Notification updated successfully!', 'success');
    } catch (error) {
      showSnackBar(`Failed to update notification: ${error}`, 'error');
    }
  };

  const showDeleteDialog = (notificationId: string, message: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this notification?\n\n"${message.length > 50 ? message.substring(0, 50) + '...' : message}"`
    );
    
    if (confirmed) {
      deleteNotification(notificationId);
    }
  };

  const showSnackBar = (message: string, type: 'success' | 'error') => {
    setSnackbar({ message, type });
    setTimeout(() => setSnackbar(null), type === 'error' ? 4000 : 2000);
  };

  const getTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffMins < 1) return 'Just now';
    if (diffHours < 1) return `${diffMins}m ago`;
    if (diffDays < 1) return `${diffHours}h ago`;
    if (diffWeeks < 1) return `${diffDays}d ago`;
    if (diffMonths < 1) return `${diffWeeks}w ago`;
    return `${diffMonths}mo ago`;
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* App Bar */}
      <div className="sticky top-0 z-40 bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 shadow-lg">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            <h1 className="text-xl font-bold text-white">Notifications</h1>
          </div>
          <button
            onClick={loadNotifications}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="pb-20">
        {/* Admin Send Section */}
        {isAdmin && (
          <div className="m-4 p-4 bg-white rounded-2xl shadow-md border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
                <span className="text-white text-[10px] font-bold">ADMIN</span>
              </div>
              <span className="font-semibold text-slate-800">Send Notification</span>
            </div>
            
            <textarea
              value={messageController}
              onChange={(e) => setMessageController(e.target.value)}
              placeholder="Type your notification message..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
            
            <button
              onClick={sendNotification}
              disabled={isSending}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white py-3 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  <span>Send Notification</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Divider with Count */}
        <div className="flex items-center mx-4 my-4">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-400/30 to-transparent" />
          <div className="px-4 py-2 bg-gradient-to-r from-slate-600 to-slate-700 rounded-full">
            <span className="text-white text-xs font-semibold">
              {notifications.length} Notifications
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-400/30 to-transparent" />
        </div>

        {/* Notifications List */}
        <div ref={scrollRef} className="px-4 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                No notifications yet
              </h3>
              <p className="text-sm text-gray-500">
                {isAdmin ? 'Send your first notification above!' : 'Stay tuned for updates!'}
              </p>
            </div>
          ) : (
            notifications.map((notification, index) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                isAdmin={isAdmin}
                isEditing={editingNotificationId === notification.id}
                editValue={editControllers[notification.id] || ''}
                onEditChange={(value) => setEditControllers(prev => ({ ...prev, [notification.id]: value }))}
                onStartEdit={() => startEditingNotification(notification.id, notification.message)}
                onCancelEdit={() => cancelEditingNotification(notification.id)}
                onSaveEdit={() => saveEditedNotification(notification.id)}
                onDelete={() => showDeleteDialog(notification.id, notification.message)}
                getTimeAgo={getTimeAgo}
              />
            ))
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {isAdmin && showFab && (
        <button
          onClick={scrollToTop}
          className={`fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-full shadow-lg flex items-center justify-center transition-all z-50 ${
            showFab ? 'scale-100' : 'scale-0'
          }`}
          style={{
            animation: showFab ? 'bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)' : 'none'
          }}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>
      )}

      {/* Snackbar */}
      {snackbar && (
        <div className="fixed bottom-6 left-4 right-4 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-xl shadow-lg ${
            snackbar.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          } text-white`}>
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
        @keyframes bounce-in {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

interface NotificationCardProps {
  notification: NotificationItem;
  isAdmin: boolean;
  isEditing: boolean;
  editValue: string;
  onEditChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  getTimeAgo: (date: string) => string;
}

function NotificationCard({
  notification,
  isAdmin,
  isEditing,
  editValue,
  onEditChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  getTimeAgo,
}: NotificationCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .auth
      .getUser()
      .then(({ data }: { data: { user: { id: string } | null } }) => {
        setCurrentUserId(data.user?.id || null);
      });
  }, []);

  const isOwnNotification = isAdmin && currentUserId === notification.created_by;

  return (
    <div className={`bg-white rounded-2xl shadow-md p-4 border-2 transition-all ${
      notification.isRead 
        ? 'border-black/10' 
        : 'border-blue-500/30'
    }`}>
      <div className="flex items-start gap-3">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-xl flex-shrink-0">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-slate-800">Admin</span>
            <span className="text-xs text-blue-600 font-medium">• Official</span>
            {!notification.isRead && (
              <span className="px-2 py-0.5 bg-pink-500 text-white text-[10px] font-bold rounded">
                NEW
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">{getTimeAgo(notification.created_at)}</p>
        </div>

        {isOwnNotification && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[120px]">
                  <button
                    onClick={() => { onStartEdit(); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => { onDelete(); setShowMenu(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-blue-100">
        {isEditing ? (
          <div>
            <textarea
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-slate-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              placeholder="Edit your notification..."
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={onCancelEdit}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={onSaveEdit}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-semibold flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-slate-700 text-sm leading-relaxed">{notification.message}</p>
        )}
      </div>
    </div>
  );
}