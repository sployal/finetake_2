'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Heart,
  MapPin,
  Star,
  Bookmark,
  BookmarkX,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  LogIn,
  X,
  CheckCircle
} from 'lucide-react';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Types
interface Post {
  id: string;
  userId: string;
  userName: string;
  imageUrl: string;
  caption: string;
  location?: string;
  tags: string[];
  createdAt: Date;
  likes: number;
  commentCount: number;
  isFeatured: boolean;
  isVerified: boolean;
  userType: string;
}

// Helper function to get comment count
async function getCommentCount(postId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', postId);
    
    if (error) {
      console.error('Error fetching comment count:', error);
      return 0;
    }
    
    return count || 0;
  } catch (err) {
    console.error('Error getting comment count:', err);
    return 0;
  }
}

// Utility function for time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffHours < 1) return `${diffMins}m ago`;
  if (diffDays < 1) return `${diffHours}h ago`;
  if (diffWeeks < 1) return `${diffDays}d ago`;
  if (diffMonths < 1) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

// Main Component
export default function MyBookmarks() {
  const [bookmarks, setBookmarks] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [postToRemove, setPostToRemove] = useState<Post | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useRef<HTMLDivElement>(null);

  const POSTS_PER_PAGE = 10;

  useEffect(() => {
    // Check authentication first
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        setIsAuthenticated(false);
        setIsLoading(false);
      } else {
        setIsAuthenticated(true);
        loadBookmarkedPosts();
      }
    };
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Infinite scroll setup
  useEffect(() => {
    if (!hasMore || isLoadingMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMoreBookmarks();
        }
      },
      { threshold: 0.5 }
    );

    if (lastPostRef.current) {
      observerRef.current.observe(lastPostRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoadingMore, bookmarks.length]);

  const loadBookmarkedPosts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        setError('Please sign in to view your bookmarks');
        setIsLoading(false);
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(true);

      // Step 1: Get bookmarks for the user
      const start = 0;
      const end = POSTS_PER_PAGE - 1;
      
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('post_id, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (bookmarksError) throw bookmarksError;

      if (!bookmarksData || bookmarksData.length === 0) {
        setBookmarks([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      // Step 2: Get posts for each bookmark
      const postIds = bookmarksData.map(b => b.post_id);
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, location, tags, likes_count, created_at, is_featured')
        .in('id', postIds);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setBookmarks([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      // Step 3: Get user profiles for each post
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, user_type, is_verified')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user profiles
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Step 4: Map bookmarks to Post interface
      const mappedBookmarks: Post[] = [];
      for (const postData of postsData) {
        const profile = profilesMap.get(postData.user_id);
        const commentCount = await getCommentCount(postData.id);
        
        mappedBookmarks.push({
          id: postData.id,
          userId: postData.user_id,
          userName: profile?.username || 'User',
          imageUrl: Array.isArray(postData.images) && postData.images.length > 0 
            ? postData.images[0] 
            : '',
          caption: postData.caption || '',
          location: postData.location || undefined,
          tags: Array.isArray(postData.tags) ? postData.tags : [],
          createdAt: new Date(postData.created_at),
          likes: postData.likes_count || 0,
          commentCount: commentCount,
          isFeatured: postData.is_featured || false,
          isVerified: profile?.is_verified || false,
          userType: profile?.user_type || 'User'
        });
      }

      // Sort by bookmark creation date (most recent first)
      const bookmarksMap = new Map(bookmarksData.map(b => [b.post_id, b.created_at]));
      mappedBookmarks.sort((a, b) => {
        const dateA = bookmarksMap.get(a.id) || a.createdAt;
        const dateB = bookmarksMap.get(b.id) || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setBookmarks(mappedBookmarks);
      setHasMore(bookmarksData.length >= POSTS_PER_PAGE);
      setCurrentPage(0);
    } catch (err: any) {
      console.error('Error loading bookmarks:', err);
      setError(`Failed to load bookmarks: ${err?.message || 'Unknown error'}`);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreBookmarks = async () => {
    if (isLoadingMore || !hasMore || !isAuthenticated) return;

    setIsLoadingMore(true);
    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) return;

      // Get more bookmarks
      const start = (currentPage + 1) * POSTS_PER_PAGE;
      const end = start + POSTS_PER_PAGE - 1;
      
      const { data: bookmarksData, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('post_id, created_at')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (bookmarksError) throw bookmarksError;

      if (!bookmarksData || bookmarksData.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Get posts for each bookmark
      const postIds = bookmarksData.map(b => b.post_id);
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, location, tags, likes_count, created_at, is_featured')
        .in('id', postIds);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Get user profiles
      const userIds = [...new Set(postsData.map(p => p.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, user_type, is_verified')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user profiles
      const profilesMap = new Map();
      if (profilesData) {
        profilesData.forEach(profile => {
          profilesMap.set(profile.id, profile);
        });
      }

      // Map to Post interface
      const mappedBookmarks: Post[] = [];
      for (const postData of postsData) {
        const profile = profilesMap.get(postData.user_id);
        const commentCount = await getCommentCount(postData.id);
        
        mappedBookmarks.push({
          id: postData.id,
          userId: postData.user_id,
          userName: profile?.username || 'User',
          imageUrl: Array.isArray(postData.images) && postData.images.length > 0 
            ? postData.images[0] 
            : '',
          caption: postData.caption || '',
          location: postData.location || undefined,
          tags: Array.isArray(postData.tags) ? postData.tags : [],
          createdAt: new Date(postData.created_at),
          likes: postData.likes_count || 0,
          commentCount: commentCount,
          isFeatured: postData.is_featured || false,
          isVerified: profile?.is_verified || false,
          userType: profile?.user_type || 'User'
        });
      }

      // Sort by bookmark creation date
      const bookmarksMap = new Map(bookmarksData.map(b => [b.post_id, b.created_at]));
      mappedBookmarks.sort((a, b) => {
        const dateA = bookmarksMap.get(a.id) || a.createdAt;
        const dateB = bookmarksMap.get(b.id) || b.createdAt;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setBookmarks(prev => [...prev, ...mappedBookmarks]);
      setHasMore(bookmarksData.length >= POSTS_PER_PAGE);
      setCurrentPage(prev => prev + 1);
    } catch (err: any) {
      console.error('Error loading more bookmarks:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    await loadBookmarkedPosts();
  };

  const toggleLike = async (postId: string, index: number) => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        showToast('Please sign in to like posts', 'error');
        return;
      }

      // Check if already liked
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUser.id)
        .single();

      let newLikes: number;
      if (existingLike) {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
        
        newLikes = bookmarks[index].likes - 1;
        showToast('Post unliked!', 'success');
      } else {
        // Like
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: currentUser.id
          });
        
        newLikes = bookmarks[index].likes + 1;
        showToast('Post liked!', 'success');
      }

      setBookmarks(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], likes: newLikes };
        return updated;
      });
    } catch (err: any) {
      console.error('Error toggling like:', err);
      showToast('Failed to update like', 'error');
    }
  };

  const handleRemoveBookmark = async () => {
    if (!postToRemove) return;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        showToast('Please sign in to remove bookmarks', 'error');
        return;
      }

      const { error } = await supabase
        .from('bookmarks')
        .delete()
        .eq('user_id', currentUser.id)
        .eq('post_id', postToRemove.id);
      
      if (error) throw error;

      setBookmarks(prev => prev.filter(p => p.id !== postToRemove.id));
      showToast('Bookmark removed!', 'success');
      setShowRemoveDialog(false);
      setPostToRemove(null);
      setSelectedPost(null);
    } catch (err: any) {
      console.error('Error removing bookmark:', err);
      showToast('Failed to remove bookmark', 'error');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    // TODO: Implement toast notification
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Not authenticated state
  if (!isAuthenticated) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center">
          <Bookmark size={64} className="mx-auto text-[#4F8A8B] mb-4" />
          <p className="text-gray-200 text-lg">Please sign in to view your bookmarks</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && bookmarks.length === 0) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4F8A8B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your bookmarks...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && bookmarks.length === 0) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle size={64} className="mx-auto text-[#4F8A8B] mb-4" />
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Failed to load bookmarks</h3>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={loadBookmarkedPosts}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#23262B] text-[#4F8A8B] rounded-lg hover:bg-[#2A2D33] transition"
          >
            <RefreshCw size={20} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (bookmarks.length === 0) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center">
          <Bookmark size={64} className="mx-auto text-[#4F8A8B] mb-4" />
          <h3 className="text-lg font-semibold text-gray-200 mb-2">No bookmarks yet</h3>
          <p className="text-gray-400 text-sm">Start bookmarking posts you love!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181A20] min-h-screen">
      {/* Header with bookmark count */}
      <div className="p-4">
        <p className="text-[#4F8A8B] font-semibold">
          {bookmarks.length} Bookmark{bookmarks.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Bookmarks Grid */}
      <div className="grid grid-cols-3 gap-1 px-2">
        {bookmarks.map((post, index) => (
          <div
            key={post.id}
            ref={index === bookmarks.length - 1 ? lastPostRef : null}
            onClick={() => setSelectedPost(post)}
            className="aspect-square bg-[#23262B] rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative group"
          >
            {/* Post Image */}
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt={post.caption || 'Post image'}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#23262B]">
                <ImageIcon size={30} className="text-[#4F8A8B]" />
              </div>
            )}

            {/* Like count badge */}
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#4F8A8B]/80 backdrop-blur-sm px-2 py-1 rounded-full">
              <Heart size={12} className="text-white fill-white" />
              <span className="text-white text-xs font-medium">{post.likes}</span>
            </div>

            {/* Bookmark indicator */}
            <div className="absolute top-2 left-2">
              <Bookmark size={20} className="text-[#FFC857] fill-[#FFC857]" />
            </div>

            {/* Featured badge */}
            {post.isFeatured && (
              <div className="absolute bottom-2 left-2">
                <Star size={16} className="text-[#FFC857] fill-[#FFC857]" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="py-8 flex justify-center">
          <div className="w-8 h-8 border-4 border-[#4F8A8B] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* No more bookmarks indicator */}
      {!hasMore && bookmarks.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-gray-400 text-sm">No more bookmarks to show</p>
        </div>
      )}

      {/* Bookmark Detail Modal */}
      {selectedPost && (
        <BookmarkDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onLike={(postId) => {
            const index = bookmarks.findIndex(p => p.id === postId);
            if (index !== -1) toggleLike(postId, index);
          }}
          onRemove={(post) => {
            setPostToRemove(post);
            setShowRemoveDialog(true);
            setSelectedPost(null);
          }}
        />
      )}

      {/* Remove Bookmark Confirmation Dialog */}
      {showRemoveDialog && postToRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#23262B] rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-200 mb-2">Remove Bookmark</h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to remove this bookmark?
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRemoveDialog(false);
                  setPostToRemove(null);
                }}
                className="px-4 py-2 text-gray-400 hover:bg-[#2A2D33] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveBookmark}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Bookmark Detail Modal Component
function BookmarkDetailModal({
  post,
  onClose,
  onLike,
  onRemove
}: {
  post: Post;
  onClose: () => void;
  onLike: (postId: string) => void;
  onRemove: (post: Post) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#23262B] rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-[#4F8A8B]/30 rounded-full" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(85vh-40px)] p-4">
          {/* Post Image */}
          <div className="rounded-xl overflow-hidden mb-4">
            {post.imageUrl ? (
              <img
                src={post.imageUrl}
                alt={post.caption || 'Post image'}
                className="w-full aspect-square object-cover"
              />
            ) : (
              <div className="w-full aspect-square bg-[#181A20] flex items-center justify-center">
                <ImageIcon size={50} className="text-[#4F8A8B]" />
              </div>
            )}
          </div>

          {/* Author info */}
          <div className="flex items-center gap-2 mb-4">
            <p className="text-[#4F8A8B] font-semibold text-base">By @{post.userName}</p>
            {post.isVerified && (
              <CheckCircle size={16} className="text-[#10B981]" />
            )}
          </div>

          {/* Likes and actions */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-200 font-semibold">{post.likes} likes</p>
            <button
              onClick={() => onLike(post.id)}
              className="p-2 hover:bg-[#2A2D33] rounded-full transition"
            >
              <Heart size={24} className="text-[#4F8A8B]" />
            </button>
          </div>

          {/* Caption */}
          {post.caption && (
            <p className="text-gray-200 text-base mb-4">{post.caption}</p>
          )}

          {/* Location */}
          {post.location && (
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-[#4F8A8B]" />
              <p className="text-gray-400 text-sm">{post.location}</p>
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1.5 bg-[#4F8A8B]/15 border border-[#4F8A8B]/30 rounded-full text-[#4F8A8B] text-xs font-medium"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Timestamp */}
          <p className="text-gray-400 text-xs mb-6">
            Posted {getTimeAgo(post.createdAt)}
          </p>

          {/* Remove Bookmark Button */}
          <div className="flex justify-center">
            <button
              onClick={() => onRemove(post)}
              className="flex items-center gap-2 px-6 py-3 bg-red-600/10 border border-red-600/30 rounded-xl hover:bg-red-600/20 transition"
            >
              <BookmarkX size={20} className="text-red-600" />
              <span className="text-red-600 text-sm font-medium">Remove Bookmark</span>
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded-full hover:bg-black/70 transition"
        >
          <X size={20} className="text-white" />
        </button>
      </div>
    </div>
  );
}