'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const SERVER_URL = 'https://fine-back2.onrender.com';

// Date formatting utilities
const formatMessageTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  } else {
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  }
};

const getDateDividerText = (date: Date) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (messageDate.getTime() === today.getTime()) return 'Today';
  if (messageDate.getTime() === yesterday.getTime()) return 'Yesterday';
  if ((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24) < 7) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default function MessageDetailScreen({ 
  conversationId: initialConversationId,
  otherUserId,
  otherUserName,
  otherUserAvatar 
}: {
  conversationId?: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar?: string;
}) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUser(user));
  }, []);

  useEffect(() => {
    loadMessages();
    if (conversationId) {
      markMessagesAsRead();
      const unsubscribe = subscribeToMessages();
      return unsubscribe;
    }
  }, [conversationId]);

  const loadMessages = async () => {
    if (!conversationId) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      showToast('Error loading messages', true);
    } finally {
      setIsLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!conversationId || !currentUser) return;
    
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId) return () => {};

    const channel = supabase
      .channel(`messages_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
        if (currentUser && payload.new.sender_id !== currentUser.id) {
          setMessages(prev => [payload.new as any, ...prev]);
          markMessagesAsRead();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getOrCreateConversation = async () => {
    if (!currentUser) throw new Error('Not authenticated');

    const userId1 = currentUser.id < otherUserId ? currentUser.id : otherUserId;
    const userId2 = currentUser.id < otherUserId ? otherUserId : currentUser.id;

    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('user1_id', userId1)
      .eq('user2_id', userId2)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        user1_id: userId1,
        user2_id: userId2,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    return newConv?.id;
  };

  const uploadImagesToCloudinary = async (files: File[]) => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', 'your_upload_preset');
      
      const response = await fetch(
        'https://api.cloudinary.com/v1_1/your_cloud_name/image/upload',
        { method: 'POST', body: formData }
      );
      
      const data = await response.json();
      uploadedUrls.push(data.secure_url);
    }
    
    return uploadedUrls;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPendingImages(prev => [...prev, ...files]);
      showToast(`${files.length} image(s) ready to send`);
    }
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    const text = messageText.trim();
    const hasText = text.length > 0;
    const hasImages = pendingImages.length > 0;

    if ((!hasText && !hasImages) || isSending || !currentUser) return;

    setIsSending(true);
    setMessageText('');

    try {
      let currentConvId = conversationId;
      if (!currentConvId) {
        currentConvId = await getOrCreateConversation();
        setConversationId(currentConvId);
      }

      let uploadedImageUrls: string[] = [];
      if (hasImages) {
        setIsUploadingImages(true);
        uploadedImageUrls = await uploadImagesToCloudinary(pendingImages);
        setIsUploadingImages(false);
      }

      const messageData: any = {
        conversation_id: currentConvId,
        sender_id: currentUser.id,
        receiver_id: otherUserId,
        content: hasText ? text : (hasImages ? '📷 Photo' : ''),
        is_read: false,
      };

      if (uploadedImageUrls.length > 0) {
        messageData.images = uploadedImageUrls;
      }

      if (replyingTo) {
        messageData.reply_to_id = replyingTo.id;
        messageData.reply_to_content = replyingTo.content;
      }

      const { data: insertedMessage } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (insertedMessage) {
        setMessages(prev => [insertedMessage, ...prev]);
      }

      setReplyingTo(null);
      setPendingImages([]);

      const lastMessageText = uploadedImageUrls.length > 0
        ? (hasText ? `${text} 📷` : '📷 Photo')
        : text;

      await supabase
        .from('conversations')
        .update({
          last_message: lastMessageText.substring(0, 100),
          last_message_at: insertedMessage?.created_at
        })
        .eq('id', currentConvId);

    } catch (error) {
      showToast('Failed to send message', true);
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async () => {
    if (!selectedMessage) return;

    try {
      await supabase
        .from('messages')
        .delete()
        .eq('id', selectedMessage.id);

      setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
      setSelectedMessage(null);
      showToast('Message deleted');
    } catch (error) {
      showToast('Failed to delete message', true);
    }
  };

  const saveEdit = async () => {
    if (!selectedMessage) return;

    setIsSending(true);
    try {
      await supabase
        .from('messages')
        .update({ content: messageText.trim() })
        .eq('id', selectedMessage.id);

      setMessages(prev => prev.map(m => 
        m.id === selectedMessage.id ? { ...m, content: messageText.trim() } : m
      ));
      
      setSelectedMessage(null);
      setIsEditMode(false);
      setMessageText('');
      showToast('Message updated');
    } catch (error) {
      showToast('Failed to update message', true);
    } finally {
      setIsSending(false);
    }
  };

  const shouldShowDateDivider = (index: number) => {
    if (index === messages.length - 1) return true;
    
    const currentDate = new Date(messages[index].created_at);
    const nextDate = new Date(messages[index + 1].created_at);
    
    return !isSameDay(currentDate, nextDate);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-50">
          <div className={`flex items-center px-4 py-3 rounded-lg shadow-lg ${
            toast.isError ? 'bg-red-400' : 'bg-green-400'
          }`}>
            <span className="text-white mr-3 text-xl">
              {toast.isError ? '⚠️' : '✓'}
            </span>
            <span className="text-white text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg">
        <div className="flex items-center px-4 py-3">
          <button
            onClick={() => selectedMessage ? setSelectedMessage(null) : window.history.back()}
            className="mr-3 hover:bg-white/20 rounded-full p-2 transition text-2xl leading-none"
          >
            {selectedMessage ? '✕' : '←'}
          </button>
          
          {selectedMessage ? (
            <div className="flex-1 flex items-center justify-between">
              <span className="font-semibold text-lg">1 selected</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsEditMode(true);
                    setMessageText(selectedMessage.content);
                  }}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={deleteMessage}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mr-3 overflow-hidden">
                {otherUserAvatar ? (
                  <img src={otherUserAvatar} alt={otherUserName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-blue-500 font-semibold text-lg">{otherUserName[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{otherUserName}</div>
                <div className="text-xs opacity-80">Tap here for info</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center mb-4">
              <span className="text-5xl">💬</span>
            </div>
            <div className="text-lg font-semibold text-gray-700 mb-2">No messages yet</div>
            <div className="text-sm text-gray-500">Send a message to start the conversation</div>
          </div>
        ) : (
          <div className="flex flex-col-reverse">
            {messages.map((message, index) => {
              const isMe = currentUser && message.sender_id === currentUser.id;
              const showDateDivider = shouldShowDateDivider(index);
              const isSelected = selectedMessage?.id === message.id;

              return (
                <div key={message.id}>
                  <MessageBubble
                    message={message}
                    isMe={isMe}
                    isSelected={isSelected}
                    time={formatMessageTime(message.created_at)}
                    onLongPress={() => isMe && setSelectedMessage(message)}
                    onSwipeReply={() => setReplyingTo(message)}
                  />
                  {showDateDivider && (
                    <div className="flex justify-center my-4">
                      <div className="bg-black/5 px-4 py-1.5 rounded-full">
                        <span className="text-xs text-gray-600 font-medium">
                          {getDateDividerText(new Date(message.created_at))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t shadow-lg p-2">
        {/* Pending Images */}
        {pendingImages.length > 0 && (
          <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
            {pendingImages.map((img, index) => (
              <div key={index} className="relative flex-shrink-0">
                <img
                  src={URL.createObjectURL(img)}
                  alt="pending"
                  className="w-20 h-20 object-cover rounded-lg border-2 border-blue-300"
                />
                <button
                  onClick={() => removePendingImage(index)}
                  className="absolute -top-2 -right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm hover:bg-black/80"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reply Preview */}
        {replyingTo && (
          <div className="mb-2 p-2 bg-slate-50 rounded-lg border border-blue-200 flex items-start">
            <div className="w-1 h-12 bg-gradient-to-b from-blue-500 to-purple-500 rounded mr-3" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-blue-600">
                {replyingTo.sender_id === currentUser?.id ? 'You' : otherUserName}
              </div>
              <div className="text-sm text-gray-700 truncate">{replyingTo.content}</div>
            </div>
            <button onClick={() => setReplyingTo(null)} className="ml-2 text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
          
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingImages}
            className="w-10 h-10 rounded-full bg-slate-100 border border-blue-200 flex items-center justify-center hover:bg-slate-200 transition disabled:opacity-50 flex-shrink-0"
          >
            {isUploadingImages ? (
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-blue-500 text-xl">🖼️</span>
            )}
          </button>

          <textarea
            ref={textareaRef}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                isEditMode ? saveEdit() : sendMessage();
              }
            }}
            placeholder={isEditMode ? 'Edit message...' : 'Type a message...'}
            className="flex-1 px-4 py-2 bg-slate-50 border border-blue-200 rounded-3xl resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={1}
          />

          <button
            onClick={isEditMode ? saveEdit : sendMessage}
            disabled={isSending}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white flex items-center justify-center shadow-lg hover:shadow-xl transition disabled:opacity-50 flex-shrink-0"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="text-lg">{isEditMode ? '✓' : '➤'}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ 
  message, 
  isMe, 
  isSelected, 
  time, 
  onLongPress, 
  onSwipeReply 
}: any) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const hasImages = message.images && message.images.length > 0;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    const startX = e.clientX;
    
    const handleMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      setDragX(Math.max(0, Math.min(diff, 80)));
    };
    
    const handleUp = () => {
      if (dragX > 50) onSwipeReply();
      setDragX(0);
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  return (
    <div
      className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2 ${
        isDragging ? 'cursor-grabbing' : 'cursor-pointer'
      }`}
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onLongPress();
      }}
    >
      <div className="relative">
        {dragX > 0 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 ${isMe ? 'right-full mr-4' : 'left-full ml-4'}`}
            style={{ opacity: dragX / 80 }}
          >
            <span className="text-2xl">↩️</span>
          </div>
        )}
        
        <div
          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-md transition-transform ${
            isMe
              ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm border border-gray-200'
          } ${isSelected ? 'ring-4 ring-pink-500' : ''}`}
          style={{ transform: `translateX(${dragX}px)` }}
        >
          {message.reply_to_content && (
            <div className={`mb-2 p-2 rounded-lg border-l-4 ${
              isMe ? 'bg-white/20 border-white' : 'bg-gray-100 border-blue-500'
            }`}>
              <div className={`text-xs italic line-clamp-2 ${isMe ? 'text-white/90' : 'text-gray-600'}`}>
                {message.reply_to_content}
              </div>
            </div>
          )}

          {hasImages && (
            <div className={`${message.content ? 'mb-2' : ''} ${
              message.images.length === 1 ? '' : 'grid grid-cols-2 gap-1'
            }`}>
              {message.images.map((img: string, idx: number) => (
                <img
                  key={idx}
                  src={img}
                  alt="message"
                  className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(img, '_blank');
                  }}
                />
              ))}
            </div>
          )}

          {message.content && <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</div>}
          
          <div className="flex items-center justify-end gap-1 mt-1">
            <span className={`text-xs ${isMe ? 'text-white/80' : 'text-gray-500'}`}>
              {time}
            </span>
            {isMe && (
              <span className={`text-sm ${message.is_read ? 'text-white' : 'text-white/70'}`}>
                {message.is_read ? '✓✓' : '✓'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}