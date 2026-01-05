'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface TagPost {
  id: string;
  imageUrl: string;
  caption: string;
  userName: string;
  likes: number;
  commentCount: number;
  isVerified: boolean;
  tags: string[];
}

interface TagCategory {
  name: string;
  postCount: number;
  posts: TagPost[];
}

export default function TagsSection() {
  const [tagCategories, setTagCategories] = useState<TagCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    loadTagsWithPosts();
  }, []);

  const loadTagsWithPosts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch posts with tags and user data
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, likes_count, comments_count, tags, created_at')
        .not('images', 'is', null)
        .neq('images', '{}')
        .not('tags', 'is', null)
        .neq('tags', '{}')
        .order('created_at', { ascending: false })
        .limit(300);

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setTagCategories([]);
        setIsLoading(false);
        return;
      }

      // Get unique user IDs
      const userIds = [...new Set(postsData.map((post: any) => post.user_id))];

      // Fetch user profiles
      const userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, display_name, is_verified')
            .in('id', userIds);

          if (!profilesError && profilesData) {
            profilesData.forEach((profile: any) => {
              userProfiles[profile.id] = profile;
            });
          }
        } catch (profileError) {
          console.warn('Could not fetch user profiles:', profileError);
        }
      }

      // Process posts and group by tags
      const tagPostsMap: Record<string, TagPost[]> = {};

      for (const postData of postsData) {
        const profile = userProfiles[postData.user_id] || {};

        // Handle images array - take first image
        let imageUrl = '';
        if (postData.images) {
          if (Array.isArray(postData.images) && postData.images.length > 0) {
            imageUrl = postData.images[0];
          } else if (typeof postData.images === 'string') {
            imageUrl = postData.images;
          }
        }

        // Handle tags array
        let tags: string[] = [];
        if (postData.tags && Array.isArray(postData.tags)) {
          tags = postData.tags.map((tag: any) => tag.toString());
        }

        if (imageUrl) {
          const tagPost: TagPost = {
            id: postData.id,
            imageUrl,
            caption: postData.caption || '',
            userName: profile.display_name || 'Anonymous',
            likes: postData.likes_count || 0,
            commentCount: postData.comments_count || 0,
            isVerified: profile.is_verified || false,
            tags,
          };

          // Add post to each of its tags
          for (const tag of tags) {
            const cleanTag = tag.trim().toLowerCase();
            if (cleanTag) {
              // Format tag with # if it doesn't have one
              const formattedTag = cleanTag.startsWith('#') ? cleanTag : `#${cleanTag}`;

              if (!tagPostsMap[formattedTag]) {
                tagPostsMap[formattedTag] = [];
              }

              // Avoid duplicate posts in same tag
              if (!tagPostsMap[formattedTag].some((p) => p.id === tagPost.id)) {
                tagPostsMap[formattedTag].push(tagPost);
              }
            }
          }
        }
      }

      // Create tag categories, sorted by post count
      const categories = Object.entries(tagPostsMap)
        .map(([name, posts]) => ({
          name,
          postCount: posts.length,
          posts,
        }))
        .filter((category) => category.postCount >= 1)
        .sort((a, b) => b.postCount - a.postCount)
        .slice(0, 15); // Top 15 tags

      setTagCategories(categories);
      console.log(`✅ Loaded ${categories.length} tag categories`);
    } catch (err) {
      setError(`Failed to load tags: ${err}`);
      console.error('❌ Error loading tags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  const navigateToTag = (category: TagCategory) => {
    router.push(`/tags/${encodeURIComponent(category.name.replace('#', ''))}`);
  };

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-4 text-slate-500 dark:text-slate-400 font-medium">
            Loading tags...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
            Failed to load tags
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error}</p>
          <button
            onClick={loadTagsWithPosts}
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

  if (tagCategories.length === 0) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-2">
            No tags found
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tags will appear when users add them to posts
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="space-y-4">
        {tagCategories.map((category) => (
          <div
            key={category.name}
            onClick={() => navigateToTag(category)}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
          >
            {/* Tag Header */}
            <div className="p-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {category.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  {formatCount(category.postCount)} posts
                </p>
              </div>
              <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  View All
                </span>
              </div>
            </div>

            {/* Images Row */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden">
                    {index < category.posts.length ? (
                      <div className="relative w-full h-full group">
                        <Image
                          src={category.posts[index].imageUrl}
                          alt={category.posts[index].caption}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 33vw, 150px"
                        />
                        {/* Stats Overlay */}
                        <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-2 text-white text-xs">
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                            </svg>
                            <span className="font-medium">{category.posts[index].likes}</span>
                          </div>
                          {category.posts[index].commentCount > 0 && (
                            <div className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                              </svg>
                              <span className="font-medium">{category.posts[index].commentCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tag Posts Detail Page Component
interface TagPostsPageProps {
  tagName: string;
}

export function TagPostsPage({ tagName }: TagPostsPageProps) {
  const [posts, setPosts] = useState<TagPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [postCount, setPostCount] = useState(0);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const router = useRouter();

  useEffect(() => {
    loadTagPosts();
  }, [tagName]);

  const loadTagPosts = async () => {
    setIsLoading(true);

    try {
      const formattedTag = tagName.startsWith('#') ? tagName : `#${tagName}`;

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('id, user_id, caption, images, likes_count, comments_count, tags')
        .contains('tags', [formattedTag])
        .not('images', 'is', null)
        .neq('images', '{}')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setPostCount(0);
        setIsLoading(false);
        return;
      }

      // Get user profiles
      const userIds = [...new Set(postsData.map((post: any) => post.user_id))];
      const userProfiles: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, is_verified')
          .in('id', userIds);

        if (profilesData) {
          profilesData.forEach((profile: any) => {
            userProfiles[profile.id] = profile;
          });
        }
      }

      const tagPosts: TagPost[] = [];

      for (const postData of postsData) {
        const profile = userProfiles[postData.user_id] || {};

        let imageUrl = '';
        if (postData.images) {
          if (Array.isArray(postData.images) && postData.images.length > 0) {
            imageUrl = postData.images[0];
          } else if (typeof postData.images === 'string') {
            imageUrl = postData.images;
          }
        }

        if (imageUrl) {
          tagPosts.push({
            id: postData.id,
            imageUrl,
            caption: postData.caption || '',
            userName: profile.display_name || 'Anonymous',
            likes: postData.likes_count || 0,
            commentCount: postData.comments_count || 0,
            isVerified: profile.is_verified || false,
            tags: postData.tags || [],
          });
        }
      }

      setPosts(tagPosts);
      setPostCount(tagPosts.length);
    } catch (error) {
      console.error('Error loading tag posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openPost = (post: TagPost) => {
    router.push(`/posts/${post.id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center p-4">
          <button
            onClick={() => router.back()}
            className="mr-4 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            {tagName.startsWith('#') ? tagName : `#${tagName}`}
          </h1>
        </div>
      </div>

      {/* Tag Info */}
      <div className="p-4">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          {postCount} posts with {tagName.startsWith('#') ? tagName : `#${tagName}`}
        </p>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-3 gap-0.5 px-0.5">
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => openPost(post)}
            className="relative aspect-square bg-white dark:bg-slate-800 cursor-pointer overflow-hidden group"
          >
            <Image
              src={post.imageUrl}
              alt={post.caption}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 33vw, 250px"
            />

            {/* Stats Overlay */}
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
          </div>
        ))}
      </div>
    </div>
  );
}