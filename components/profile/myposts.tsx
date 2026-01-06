'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  Heart,
  MapPin,
  Star,
  Edit,
  Share2,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  LogIn,
  X
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
export default function MyPosts() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);

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
        loadUserPosts();
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
          loadMorePosts();
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
  }, [hasMore, isLoadingMore, posts.length]);

  const loadUserPosts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        setError('Please sign in to view your posts');
        setIsLoading(false);
        setIsAuthenticated(false);
        return;
      }

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, user_type, is_verified')
        .eq('id', currentUser.id)
        .single();

      // Fetch user posts
      const start = 0;
      const end = POSTS_PER_PAGE - 1;
      
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, location, tags, likes_count, created_at, is_featured')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setHasMore(false);
        setIsLoading(false);
        return;
      }

      // Map posts to Post interface
      const mappedPosts: Post[] = [];
      for (const postData of postsData) {
        const commentCount = await getCommentCount(postData.id);
        
        mappedPosts.push({
          id: postData.id,
          userId: postData.user_id,
          userName: profileData?.username || 'User',
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
          isVerified: profileData?.is_verified || false,
          userType: profileData?.user_type || 'User'
        });
      }

      setPosts(mappedPosts);
      setHasMore(mappedPosts.length >= POSTS_PER_PAGE);
      setCurrentPage(0);
    } catch (err: any) {
      console.error('Error loading posts:', err);
      setError(`Failed to load your posts: ${err?.message || 'Unknown error'}`);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMore || !isAuthenticated) return;

    setIsLoadingMore(true);
    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) return;

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('username, user_type, is_verified')
        .eq('id', currentUser.id)
        .single();

      // Fetch more posts
      const start = (currentPage + 1) * POSTS_PER_PAGE;
      const end = start + POSTS_PER_PAGE - 1;
      
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, location, tags, likes_count, created_at, is_featured')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .range(start, end);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setHasMore(false);
        setIsLoadingMore(false);
        return;
      }

      // Map posts to Post interface
      const mappedPosts: Post[] = [];
      for (const postData of postsData) {
        const commentCount = await getCommentCount(postData.id);
        
        mappedPosts.push({
          id: postData.id,
          userId: postData.user_id,
          userName: profileData?.username || 'User',
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
          isVerified: profileData?.is_verified || false,
          userType: profileData?.user_type || 'User'
        });
      }

      setPosts(prev => [...prev, ...mappedPosts]);
      setHasMore(mappedPosts.length >= POSTS_PER_PAGE);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      console.error('Error loading more posts:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    await loadUserPosts();
  };

  const toggleLike = async (postId: string, index: number) => {
    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
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

      if (existingLike) {
        // Unlike: remove like
        const { error: deleteError } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);

        if (deleteError) throw deleteError;

        // Update likes count
        const { data: postData } = await supabase
          .from('posts')
          .select('likes_count')
          .eq('id', postId)
          .single();

        const newLikesCount = Math.max(0, (postData?.likes_count || 0) - 1);

        await supabase
          .from('posts')
          .update({ likes_count: newLikesCount })
          .eq('id', postId);

        setPosts(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], likes: newLikesCount };
          return updated;
        });
        showToast('Post unliked!', 'success');
      } else {
        // Like: add like
        const { error: insertError } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: currentUser.id });

        if (insertError) throw insertError;

        // Update likes count
        const { data: postData } = await supabase
          .from('posts')
          .select('likes_count')
          .eq('id', postId)
          .single();

        const newLikesCount = (postData?.likes_count || 0) + 1;

        await supabase
          .from('posts')
          .update({ likes_count: newLikesCount })
          .eq('id', postId);

        setPosts(prev => {
          const updated = [...prev];
          updated[index] = { ...updated[index], likes: newLikesCount };
          return updated;
        });
        showToast('Post liked!', 'success');
      }
    } catch (err: any) {
      console.error('Error toggling like:', err);
      showToast('Failed to update like', 'error');
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;

    try {
      // Get current authenticated user
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) {
        showToast('Please sign in to delete posts', 'error');
        return;
      }

      // Verify ownership
      const { data: postData } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postToDelete.id)
        .single();

      if (!postData || postData.user_id !== currentUser.id) {
        showToast('You can only delete your own posts', 'error');
        return;
      }

      // Delete related data first (likes, comments, bookmarks)
      await supabase.from('post_likes').delete().eq('post_id', postToDelete.id);
      await supabase.from('comments').delete().eq('post_id', postToDelete.id);
      await supabase.from('bookmarks').delete().eq('post_id', postToDelete.id);

      // Delete the post
      const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('id', postToDelete.id);

      if (deleteError) throw deleteError;

      setPosts(prev => prev.filter(p => p.id !== postToDelete.id));
      showToast('Post deleted successfully', 'success');
      setShowDeleteDialog(false);
      setPostToDelete(null);
      setSelectedPost(null);
    } catch (err: any) {
      console.error('Error deleting post:', err);
      showToast(`Failed to delete post: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleSharePost = (post: Post) => {
    if (navigator.share) {
      navigator.share({
        title: post.caption || 'Check out this post',
        text: post.caption,
        url: window.location.href
      }).catch(err => console.log('Error sharing:', err));
    } else {
      // Fallback: copy link to clipboard
      navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard', 'success');
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    // TODO: Implement toast notification
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Not authenticated state
  if (isAuthenticated === false) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center">
          <LogIn size={64} className="mx-auto text-[#4F8A8B] mb-4" />
          <p className="text-gray-200 text-lg">Please sign in to view your posts</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && posts.length === 0) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4F8A8B] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your posts...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && posts.length === 0) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center p-8">
          <AlertCircle size={64} className="mx-auto text-[#4F8A8B] mb-4" />
          <h3 className="text-lg font-semibold text-gray-200 mb-2">Failed to load posts</h3>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button
            onClick={loadUserPosts}
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
  if (posts.length === 0) {
    return (
      <div className="min-h-[400px] bg-[#181A20] flex items-center justify-center">
        <div className="text-center">
          <ImageIcon size={64} className="mx-auto text-[#4F8A8B] mb-4" />
          <h3 className="text-lg font-semibold text-gray-200 mb-2">No posts yet</h3>
          <p className="text-gray-400 text-sm">Share your first post to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#181A20] min-h-screen">
      {/* Header with post count */}
      <div className="p-4">
        <p className="text-[#4F8A8B] font-semibold">
          {posts.length} Post{posts.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-3 gap-1 px-2">
        {posts.map((post, index) => (
          <div
            key={post.id}
            ref={index === posts.length - 1 ? lastPostRef : null}
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

            {/* Featured badge */}
            {post.isFeatured && (
              <div className="absolute top-2 left-2">
                <Star size={20} className="text-[#FFC857] fill-[#FFC857]" />
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

      {/* No more posts indicator */}
      {!hasMore && posts.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-gray-400 text-sm">No more posts to show</p>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onLike={(postId) => {
            const index = posts.findIndex(p => p.id === postId);
            if (index !== -1) toggleLike(postId, index);
          }}
          onEdit={(post) => {
            // TODO: Navigate to edit page
            console.log('Edit post:', post);
            setSelectedPost(null);
          }}
          onShare={(post) => {
            handleSharePost(post);
            setSelectedPost(null);
          }}
          onDelete={(post) => {
            setPostToDelete(post);
            setShowDeleteDialog(true);
            setSelectedPost(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && postToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#23262B] rounded-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-200 mb-2">Delete Post</h2>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete this post? This action cannot be undone.
            </p>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setPostToDelete(null);
                }}
                className="px-4 py-2 text-gray-400 hover:bg-[#2A2D33] rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Post Detail Modal Component
function PostDetailModal({
  post,
  onClose,
  onLike,
  onEdit,
  onShare,
  onDelete
}: {
  post: Post;
  onClose: () => void;
  onLike: (postId: string) => void;
  onEdit: (post: Post) => void;
  onShare: (post: Post) => void;
  onDelete: (post: Post) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-[#23262B] rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
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
                className="w-full h-[300px] object-cover"
              />
            ) : (
              <div className="w-full h-[300px] bg-[#181A20] flex items-center justify-center">
                <ImageIcon size={50} className="text-[#4F8A8B]" />
              </div>
            )}
          </div>

          {/* Likes and actions */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[#4F8A8B] font-semibold">{post.likes} likes</p>
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

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onEdit(post)}
              className="flex flex-col items-center gap-2 p-4 bg-[#667EEA]/10 border border-[#667EEA]/30 rounded-xl hover:bg-[#667EEA]/20 transition"
            >
              <Edit size={24} className="text-[#667EEA]" />
              <span className="text-[#667EEA] text-sm font-medium">Edit</span>
            </button>

            <button
              onClick={() => onShare(post)}
              className="flex flex-col items-center gap-2 p-4 bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl hover:bg-[#10B981]/20 transition"
            >
              <Share2 size={24} className="text-[#10B981]" />
              <span className="text-[#10B981] text-sm font-medium">Share</span>
            </button>

            <button
              onClick={() => onDelete(post)}
              className="flex flex-col items-center gap-2 p-4 bg-red-600/10 border border-red-600/30 rounded-xl hover:bg-red-600/20 transition"
            >
              <Trash2 size={24} className="text-red-600" />
              <span className="text-red-600 text-sm font-medium">Delete</span>
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