'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Simple Post type
type Post = {
  id: string;
  userId: string;
  userName: string;
  imageUrl: string;
  caption: string;
  location?: string;
  tags: string[];
  createdAt: string;
  isVerified: boolean;
  userType: string;
  likes: number;
  commentCount: number;
  isFeatured: boolean;
  avatarUrl?: string;
};

export default function CommunityPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());
  const [bookmarkedPosts, setBookmarkedPosts] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState<{post: Post, index: number} | null>(null);
  const [showImage, setShowImage] = useState<string | null>(null);
  
  const observer = useRef<IntersectionObserver>();
  const lastPostRef = useRef<HTMLDivElement>(null);

  const POSTS_PER_PAGE = 10;

  // Get profile color
  const getColor = (userId: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-orange-500', 'bg-green-500', 'bg-red-500'];
    const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  // Get time ago
  const getTimeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (mins < 1) return 'Just now';
    if (hours < 1) return `${mins}m ago`;
    if (days < 1) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  // Check user auth
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single();
        setIsAdmin(data?.is_admin || false);
      }
    };
    getUser();
  }, []);

  // Fetch likes and bookmarks
  const fetchUserData = async () => {
    if (!currentUser) return;

    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id')
      .eq('user_id', currentUser.id);
    
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select('post_id')
      .eq('user_id', currentUser.id);

    if (likes) setLikedPosts(new Set(likes.map(l => l.post_id)));
    if (bookmarks) setBookmarkedPosts(new Set(bookmarks.map(b => b.post_id)));
  };

  // Load posts
  const loadPosts = async (pageNum: number) => {
    const start = pageNum * POSTS_PER_PAGE;
    const end = start + POSTS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from('posts_with_users')
      .select('*')
      .order('created_at', { ascending: false })
      .range(start, end);

    if (error) {
      console.error('Error loading posts:', error);
      return [];
    }

    return data.map((p: any) => ({
      id: p.id,
      userId: p.user_id,
      userName: p.username || p.display_name || 'Anonymous',
      imageUrl: p.images?.[0] || '',
      caption: p.caption || '',
      location: p.location,
      tags: p.tags || [],
      createdAt: p.created_at,
      isVerified: p.is_verified || false,
      userType: p.user_type || 'Photography Enthusiast',
      likes: p.likes_count || 0,
      commentCount: p.comments_count || 0,
      isFeatured: p.is_featured || false,
      avatarUrl: p.avatar_url,
    }));
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUserData();
      const newPosts = await loadPosts(0);
      setPosts(newPosts);
      setHasMore(newPosts.length >= POSTS_PER_PAGE);
      setLoading(false);
    };
    init();
  }, [currentUser]);

  // Infinite scroll
  useEffect(() => {
    if (loading) return;

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore();
      }
    });

    if (lastPostRef.current) {
      observer.current.observe(lastPostRef.current);
    }

    return () => observer.current?.disconnect();
  }, [loading, hasMore, loadingMore]);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const newPosts = await loadPosts(nextPage);
    
    if (newPosts.length > 0) {
      setPosts(prev => [...prev, ...newPosts]);
      setPage(nextPage);
      setHasMore(newPosts.length >= POSTS_PER_PAGE);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  // Toggle like
  const toggleLike = async (postId: string, index: number) => {
    if (!currentUser) {
      alert('Please sign in to like posts');
      return;
    }

    const wasLiked = likedPosts.has(postId);
    const newLiked = new Set(likedPosts);
    
    if (wasLiked) {
      newLiked.delete(postId);
    } else {
      newLiked.add(postId);
    }
    setLikedPosts(newLiked);

    const newPosts = [...posts];
    newPosts[index].likes += wasLiked ? -1 : 1;
    setPosts(newPosts);

    try {
      if (wasLiked) {
        await supabase.from('post_likes').delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase.from('post_likes').insert({
          post_id: postId,
          user_id: currentUser.id
        });
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  // Toggle bookmark
  const toggleBookmark = async (postId: string) => {
    if (!currentUser) {
      alert('Please sign in to bookmark posts');
      return;
    }

    const wasBookmarked = bookmarkedPosts.has(postId);
    const newBookmarked = new Set(bookmarkedPosts);
    
    if (wasBookmarked) {
      newBookmarked.delete(postId);
    } else {
      newBookmarked.add(postId);
    }
    setBookmarkedPosts(newBookmarked);

    try {
      if (wasBookmarked) {
        await supabase.from('bookmarks').delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id);
      } else {
        await supabase.from('bookmarks').insert({
          post_id: postId,
          user_id: currentUser.id
        });
      }
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  // Share post
  const sharePost = (post: Post) => {
    let text = post.caption ? `${post.caption}\n\n` : '';
    if (post.location) text += `📍 ${post.location}\n\n`;
    if (post.tags.length) text += `${post.tags.map(t => `#${t}`).join(' ')}\n\n`;
    text += 'Shared from FineTake';

    if (navigator.share) {
      navigator.share({ title: 'FineTake Post', text, url: post.imageUrl });
    } else {
      navigator.clipboard.writeText(text);
      alert('Copied to clipboard!');
    }
  };

  // Delete post
  const deletePost = async (postId: string, index: number) => {
    if (!confirm('Delete this post?')) return;

    try {
      await supabase.from('posts').delete().eq('id', postId);
      setPosts(posts.filter((_, i) => i !== index));
      setShowModal(null);
    } catch (err) {
      alert('Failed to delete post');
    }
  };

  // Refresh
  const refresh = async () => {
    setPage(0);
    const newPosts = await loadPosts(0);
    setPosts(newPosts);
    setHasMore(newPosts.length >= POSTS_PER_PAGE);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">FineTake Community</h1>
          <button onClick={refresh} className="p-2 hover:bg-slate-100 rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Section Header */}
        <div className="flex items-center gap-4 my-8">
          <div className="flex-1 h-px bg-slate-300"></div>
          <span className="px-4 py-2 bg-slate-600 text-white text-xs font-semibold rounded-full">
            Recent Posts
          </span>
          <div className="flex-1 h-px bg-slate-300"></div>
        </div>

        {/* Posts */}
        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-500 mb-4">No posts yet</p>
            <button onClick={refresh} className="px-6 py-3 bg-blue-500 text-white rounded-lg">
              Refresh
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post, i) => {
              const isUserPost = currentUser?.id === post.userId;
              const isLiked = likedPosts.has(post.id);
              const isBookmarked = bookmarkedPosts.has(post.id);

              return (
                <div key={post.id} ref={i === posts.length - 1 ? lastPostRef : null}
                  className="bg-white rounded-2xl shadow-lg border-2 border-blue-200">
                  
                  {/* Header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${!post.avatarUrl ? getColor(post.userId) : ''}`}>
                        {post.avatarUrl ? (
                          <img src={post.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          post.userName[0]?.toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{post.userName}</span>
                          {post.isVerified && (
                            <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                            </svg>
                          )}
                          {isUserPost && (
                            <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold rounded">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{post.userType}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {post.isFeatured && (
                        <span className="px-2 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-lg flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          Featured
                        </span>
                      )}
                      <button onClick={() => setShowModal({post, index: i})} className="p-2 hover:bg-slate-100 rounded-full">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Image */}
                  <div className="relative h-96 bg-slate-200 cursor-pointer" onClick={() => setShowImage(post.imageUrl)}>
                    {post.imageUrl && (
                      <img src={post.imageUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="font-semibold">{post.likes} likes</p>
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleLike(post.id, i)} className="p-2 hover:bg-slate-100 rounded-full">
                          <svg className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : 'text-pink-600'}`} 
                            fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-full flex items-center gap-1">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          {post.commentCount > 0 && <span className="text-sm text-purple-600">{post.commentCount}</span>}
                        </button>
                        <button onClick={() => sharePost(post)} className="p-2 hover:bg-slate-100 rounded-full">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                        <button onClick={() => toggleBookmark(post.id)} className="p-2 hover:bg-slate-100 rounded-full">
                          <svg className={`w-6 h-6 ${isBookmarked ? 'fill-amber-500 text-amber-500' : 'text-slate-600'}`}
                            fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {post.caption && <p className="text-slate-800 mb-2">{post.caption}</p>}
                    
                    {post.location && (
                      <div className="flex items-center gap-1 text-slate-600 mb-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-sm">{post.location}</span>
                      </div>
                    )}

                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {post.tags.slice(0, 5).map((tag, j) => (
                          <span key={j} className="text-sm font-medium text-blue-600">#{tag}</span>
                        ))}
                      </div>
                    )}

                    {post.commentCount > 0 && (
                      <button className="text-sm font-medium text-blue-700 mb-2">
                        View {post.commentCount === 1 ? '1 comment' : `all ${post.commentCount} comments`}
                      </button>
                    )}

                    <p className="text-xs text-slate-500">{getTimeAgo(post.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {loadingMore && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <p className="text-center text-slate-500 py-8">You've reached the end!</p>
        )}
      </main>

      {/* Options Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-4"
          onClick={() => setShowModal(null)}>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-6"></div>
            
            <button onClick={() => { sharePost(showModal.post); setShowModal(null); }}
              className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-lg mb-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share Post</span>
            </button>

            {currentUser?.id !== showModal.post.userId && (
              <button onClick={() => { alert('Report submitted!'); setShowModal(null); }}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-lg mb-2">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                </svg>
                <span>Report Post</span>
              </button>
            )}

            {(isAdmin || currentUser?.id === showModal.post.userId) && (
              <button onClick={() => deletePost(showModal.post.id, showModal.index)}
                className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-lg mb-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="text-red-600">Delete Post</span>
              </button>
            )}

            <button onClick={() => setShowModal(null)}
              className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 rounded-lg">
              <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-slate-600">Cancel</span>
            </button>
          </div>
        </div>
      )}

      {/* Full Image Modal */}
      {showImage && (
        <div className="fixed inset-0 bg-black z-50 flex items-center justify-center p-4"
          onClick={() => setShowImage(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white hover:bg-opacity-20 rounded-full">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={showImage} alt="" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}