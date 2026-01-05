'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface ExplorePost {
  id: string;
  userId: string;
  imageUrl: string;
  caption: string;
  userName: string;
  avatarUrl?: string;
  location?: string;
  likes: number;
  commentCount: number;
  isVerified: boolean;
}

interface ExplorePageProps {
  searchQuery?: string;
}

export default function ExplorePage({ searchQuery = '' }: ExplorePageProps) {
  const [posts, setPosts] = useState<ExplorePost[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<ExplorePost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  
  const observerTarget = useRef<HTMLDivElement>(null);
  const supabase = createClientComponentClient();
  const router = useRouter();
  
  const POSTS_PER_PAGE = 20;

  // Filter posts based on search query
  useEffect(() => {
    if (searchQuery === '') {
      setFilteredPosts([...posts]);
    } else {
      const filtered = posts.filter((post) => {
        const query = searchQuery.toLowerCase();
        return (
          post.caption.toLowerCase().includes(query) ||
          post.userName.toLowerCase().includes(query) ||
          post.location?.toLowerCase().includes(query)
        );
      });
      setFilteredPosts(filtered);
    }
  }, [searchQuery, posts]);

  // Get comment count for a specific post
  const getCommentCount = async (postId: string): Promise<number> => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select('id')
        .eq('post_id', postId);
      
      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error(`Error getting comment count for post ${postId}:`, error);
      return 0;
    }
  };

  // Load posts from Supabase
  const loadPosts = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch posts with images
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, location, likes_count, created_at')
        .not('images', 'is', null)
        .neq('images', '{}')
        .order('created_at', { ascending: false })
        .range(currentPage * POSTS_PER_PAGE, (currentPage + 1) * POSTS_PER_PAGE - 1);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        if (currentPage === 0) {
          setPosts([]);
        }
        setHasMore(false);
        setIsLoading(false);
        setIsLoadingMore(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(postsData.map((post) => post.user_id))];

      // Fetch user profiles
      const userProfiles: Record<string, any> = {};
      
      if (userIds.length > 0) {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, is_verified')
            .in('id', userIds);

          if (!profilesError && profilesData) {
            profilesData.forEach((profile) => {
              userProfiles[profile.id] = profile;
            });
          }
        } catch (profileError) {
          console.warn('Could not fetch user profiles:', profileError);
        }
      }

      // Combine posts with user data and fetch comment counts
      const newPosts: ExplorePost[] = [];

      for (const postData of postsData) {
        const profile = userProfiles[postData.user_id] || {};
        
        // Get actual comment count
        const commentCount = await getCommentCount(postData.id);
        
        // Handle images array - take first image
        let imageUrl = '';
        if (postData.images) {
          if (Array.isArray(postData.images) && postData.images.length > 0) {
            imageUrl = postData.images[0];
          } else if (typeof postData.images === 'string') {
            imageUrl = postData.images;
          }
        }

        if (imageUrl) {
          newPosts.push({
            id: postData.id,
            userId: postData.user_id,
            imageUrl,
            caption: postData.caption || '',
            userName: profile.display_name || 'Anonymous',
            avatarUrl: profile.avatar_url,
            location: postData.location,
            likes: postData.likes_count || 0,
            commentCount,
            isVerified: profile.is_verified || false,
          });
        }
      }

      setPosts((prev) => (currentPage === 0 ? newPosts : [...prev, ...newPosts]));
      setHasMore(newPosts.length >= POSTS_PER_PAGE);
      setCurrentPage((prev) => prev + 1);
      
      console.log(`✅ Loaded ${newPosts.length} posts`);
    } catch (err) {
      setError(`Failed to load posts: ${err}`);
      console.error('❌ Error loading posts:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [currentPage, isLoading, supabase]);

  // Initial load
  useEffect(() => {
    loadPosts();
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading && !isLoadingMore) {
          setIsLoadingMore(true);
          loadPosts();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadPosts]);

  // Refresh posts
  const refreshPosts = async () => {
    setCurrentPage(0);
    setHasMore(true);
    setPosts([]);
    await loadPosts();
  };

  // Navigate to post details
  const navigateToPost = (post: ExplorePost) => {
    router.push(`/explore/${post.id}`);
  };

  if (isLoading && posts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">
            Loading explore posts...
          </p>
        </div>
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
            Failed to load explore posts
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={refreshPosts}
            className="inline-flex items-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (filteredPosts.length === 0 && searchQuery) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
            No posts found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Try searching for something else
          </p>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
            No posts to explore
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Check back later for new content!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {searchQuery && (
        <div className="p-4">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            Showing {filteredPosts.length} result{filteredPosts.length === 1 ? '' : 's'} for "{searchQuery}"
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => navigateToPost(post)}
            className="relative aspect-square bg-white dark:bg-slate-800 rounded cursor-pointer overflow-hidden group"
          >
            <Image
              src={post.imageUrl}
              alt={post.caption}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
            />
            
            {/* Overlay with stats */}
            <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-2 text-white text-xs">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{post.likes}</span>
              </div>
              
              {post.commentCount > 0 && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">{post.commentCount}</span>
                </div>
              )}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="text-white text-center px-2">
                <p className="font-semibold text-sm mb-1">{post.userName}</p>
                {post.location && (
                  <p className="text-xs opacity-90">{post.location}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Loading more indicator */}
      {isLoadingMore && (
        <div className="py-8 flex justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        </div>
      )}

      {/* End of posts message */}
      {!hasMore && filteredPosts.length > 0 && (
        <div className="py-8 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You've seen all posts!
          </p>
        </div>
      )}

      {/* Infinite scroll trigger */}
      <div ref={observerTarget} className="h-20" />
    </div>
  );
}